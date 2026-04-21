import { useEffect, useState, useMemo } from "react";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { timeStringToMinutes } from "@/lib/booking-time";
import { cn } from "@/lib/utils";

interface RescheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  onSuccess: () => void;
}

export default function RescheduleModal({ open, onOpenChange, appointment, onSuccess }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [settings, setSettings] = useState<any | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && appointment) {
      setSelectedDate(undefined);
      setSelectedTime(null);
      setSchedules([]);
      setBookedSlots([]);
    }
  }, [open, appointment]);

  useEffect(() => {
    if (!open || !appointment) return;
    const fetchBarberInfo = async () => {
      let tenantId = appointment.tenant_id;
      if (!tenantId && appointment.barber_id) {
        const { data: b } = await supabase.from("barbers").select("tenant_id").eq("id", appointment.barber_id).maybeSingle();
        tenantId = b?.tenant_id;
      }
      if (tenantId) {
        const { data: s } = await supabase.from("settings").select("opening_time,closing_time,appointment_interval").eq("tenant_id", tenantId).maybeSingle();
        if (s) setSettings(s);
      }
      
      if (appointment.barber_id) {
        const { data: scheds } = await supabase.from("barber_schedules")
          .select("day_of_week,start_time,end_time,is_active")
          .eq("barber_id", appointment.barber_id)
          .eq("is_active", true);
        if (scheds) setSchedules(scheds);
      }
    };
    fetchBarberInfo();
  }, [open, appointment]);

  useEffect(() => {
    if (!open || !appointment || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const fetchBooked = async () => {
      const { data } = await supabase.from("appointments").select("appointment_time")
        .eq("barber_id", appointment.barber_id)
        .eq("appointment_date", dateStr)
        .in("status", ["confirmed", "completed"]);
      setBookedSlots(data?.map(d => d.appointment_time) || []);
    };
    fetchBooked();
  }, [selectedDate, appointment, open]);

  const canDisableDate = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return true;
    if (schedules.length > 0) {
      const dow = date.getDay();
      return !schedules.some(s => s.day_of_week === dow);
    }
    return false;
  };

  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dayOfWeek = selectedDate.getDay();
    const barberSchedule = schedules.find(s => s.day_of_week === dayOfWeek);

    const openH = barberSchedule?.start_time ?? settings?.opening_time ?? "09:00";
    const closeH = barberSchedule?.end_time ?? settings?.closing_time ?? "19:00";

    let mins = timeStringToMinutes(openH);
    const end = timeStringToMinutes(closeH);
    const interval = settings?.appointment_interval || 30;
    if (interval <= 0 || mins >= end) return [];
    
    const slots: string[] = [];
    const now = new Date();

    while (mins < end) {
      const h = String(Math.floor(mins / 60)).padStart(2, "0");
      const m = String(mins % 60).padStart(2, "0");
      const slot = `${h}:${m}`;
      
      if (isToday(selectedDate)) {
        const slotMins = parseInt(h) * 60 + parseInt(m);
        const nowMins = now.getHours() * 60 + now.getMinutes();
        if (slotMins <= nowMins) { mins += interval; continue; }
      }
      
      slots.push(slot);
      mins += interval;
    }
    return slots;
  }, [settings, selectedDate, schedules]);

  const handleConfirm = async () => {
    if (!appointment || !selectedDate || !selectedTime) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    setSubmitting(true);
    
    const { data: existing } = await supabase.from("appointments")
      .select("id")
      .eq("barber_id", appointment.barber_id)
      .eq("appointment_date", dateStr)
      .eq("appointment_time", selectedTime)
      .in("status", ["confirmed", "completed"])
      .limit(1);

    if (existing && existing.length > 0) {
      toast.error("Este horário acabou de ser reservado. Escolha outro.");
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from("appointments")
        .update({ appointment_date: dateStr, appointment_time: selectedTime })
        .eq("id", appointment.id);

      if (error) throw error;

      if (appointment.google_event_id) {
        await supabase.functions.invoke("sync-google-calendar", {
          body: { appointment_id: appointment.id, action: "update" }
        }).catch(console.error);
      }

      let userEmail = appointment.profiles?.email;
      let userName = appointment.profiles?.full_name || "Cliente";
      
      if (!userEmail) {
        const { data: prof } = await supabase.from("profiles").select("email, full_name").eq("id", appointment.user_id).maybeSingle();
        if (prof?.email) userEmail = prof.email;
        if (prof?.full_name) userName = prof.full_name;
      }

      const barberName = appointment.barbers?.name || "Barbeiro";
      const serviceName = appointment.services?.name || "Serviço";
      const oldDateF = format(new Date(appointment.appointment_date + "T00:00"), "dd/MM/yyyy");

      if (userEmail) {
        await supabase.functions.invoke("send-booking-email", {
          body: {
            to: userEmail,
            subject: "Reagendamento Confirmado - AutoBarber",
            appointment: {
              barber_name: barberName,
              service_name: serviceName,
              date: format(selectedDate, "dd/MM/yyyy"),
              time: selectedTime,
              price: appointment.services?.price || appointment.services?.price === 0 ? appointment.services.price : 0,
            }
          }
        }).catch(console.error);
      }

      await supabase.functions.invoke("send-push", {
        body: {
          user_id: appointment.user_id,
          title: "📅 Agendamento reagendado",
          message: `O agendamento para ${serviceName} foi reagendado para ${format(selectedDate, "dd/MM/yyyy")} às ${selectedTime}.`,
          url: "/appointments"
        }
      }).catch(console.error);

      toast.success("Agendamento reagendado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Ocorreu um erro ao reagendar.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider text-neon">REAGENDAR</DialogTitle>
          <DialogDescription>
            Agendamento atual: {format(new Date(appointment.appointment_date + "T00:00"), "dd/MM/yyyy")} às {appointment.appointment_time} <br/>
            Com {appointment.barbers?.name || "Barbeiro"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {!selectedDate ? (
            <div className="w-full">
              <p className="text-sm text-center mb-2 font-semibold">1. Escolha a nova data:</p>
              <div className="flex justify-center border rounded-lg bg-card p-2 shadow-elevated">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={canDisableDate}
                  locale={ptBR}
                />
              </div>
            </div>
          ) : (
            <div className="w-full">
               <div className="flex justify-between items-center mb-3">
                 <p className="text-sm font-semibold">
                   2. Escolha o horário para {format(selectedDate, "dd/MM")}:
                 </p>
                 <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(undefined); setSelectedTime(null); }}>Voltar Date</Button>
               </div>
               
               <div className="grid grid-cols-4 gap-2 max-h-[250px] overflow-y-auto p-1">
                 {timeSlots.map(slot => {
                   const booked = bookedSlots.includes(slot);
                   return (
                     <button
                       key={slot}
                       disabled={booked}
                       onClick={() => setSelectedTime(slot)}
                       className={cn(
                         "py-2 rounded-md justify-center text-xs font-display tracking-wide border transition-all",
                         booked ? "bg-muted/30 text-muted-foreground border-muted/30 cursor-not-allowed line-through"
                                : selectedTime === slot ? "bg-primary text-primary-foreground border-primary shadow-elevated"
                                : "bg-card border-neon hover:border-primary hover:text-primary"
                       )}
                     >
                       {slot}
                     </button>
                   );
                 })}
                 {timeSlots.length === 0 && <p className="col-span-full text-center text-xs text-muted-foreground">Nenhum horário disponível nesta data.</p>}
               </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="neon" onClick={handleConfirm} disabled={!selectedDate || !selectedTime || submitting}>
            {submitting ? "Reagendando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
