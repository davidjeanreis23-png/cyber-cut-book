import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";

import GlassCard from "@/components/GlassCard";
import StepperBar from "@/components/StepperBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Scissors, Clock, DollarSign, MapPin, Banknote, CreditCard as CreditCardIcon, QrCode } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

const STEPS = ["Barbeiro", "Serviço", "Data", "Horário", "Confirmar"];

interface Barber {
  id: string; name: string; photo_url: string | null; specialties: string[] | null;
}
interface Service {
  id: string; name: string; description: string | null; duration_minutes: number; price: number; category: string | null;
}
interface Settings {
  opening_time: string; closing_time: string; appointment_interval: number; barber_address?: string | null;
}
interface Schedule {
  day_of_week: number; start_time: string; end_time: string; is_active: boolean;
}

const Booking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(searchParams.get("barber"));
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("local");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [b, s, set] = await Promise.all([
        supabase.from("barbers").select("id,name,photo_url,specialties").eq("is_active", true),
        supabase.from("services").select("id,name,description,duration_minutes,price,category").eq("is_active", true),
        supabase.from("settings").select("opening_time,closing_time,appointment_interval,barber_address").limit(1).single(),
      ]);
      if (b.data) setBarbers(b.data);
      if (s.data) setServices(s.data);
      if (set.data) setSettings(set.data);
    };
    fetch();
  }, []);

  // Fetch barber schedules when barber selected
  useEffect(() => {
    if (!selectedBarber) return;
    supabase.from("barber_schedules").select("day_of_week,start_time,end_time,is_active")
      .eq("barber_id", selectedBarber).eq("is_active", true)
      .then(({ data }) => { if (data) setSchedules(data); });
  }, [selectedBarber]);

  // Fetch booked slots for selected barber + date
  useEffect(() => {
    if (!selectedBarber || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    supabase.from("appointments").select("appointment_time")
      .eq("barber_id", selectedBarber)
      .eq("appointment_date", dateStr)
      .in("status", ["confirmed", "completed"])
      .then(({ data }) => {
        setBookedSlots(data?.map(d => d.appointment_time) || []);
      });
  }, [selectedBarber, selectedDate]);

  // Generate time slots
  const timeSlots = useMemo(() => {
    if (!settings || !selectedDate) return [];
    const dayOfWeek = selectedDate.getDay();
    const barberSchedule = schedules.find(s => s.day_of_week === dayOfWeek);

    const openH = barberSchedule ? barberSchedule.start_time : settings.opening_time;
    const closeH = barberSchedule ? barberSchedule.end_time : settings.closing_time;

    const [oh, om] = openH.split(":").map(Number);
    const [ch, cm] = closeH.split(":").map(Number);
    const interval = settings.appointment_interval;
    const slots: string[] = [];
    let mins = oh * 60 + om;
    const end = ch * 60 + cm;
    const now = new Date();

    while (mins < end) {
      const h = String(Math.floor(mins / 60)).padStart(2, "0");
      const m = String(mins % 60).padStart(2, "0");
      const slot = `${h}:${m}`;
      
      // Block past times for today
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

  const selectedBarberData = barbers.find(b => b.id === selectedBarber);
  const selectedServiceData = services.find(s => s.id === selectedService);

  const handleConfirm = async () => {
    if (!user || !selectedBarber || !selectedService || !selectedDate || !selectedTime) return;
    setSubmitting(true);

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // Double-check availability
    const { data: existing } = await supabase.from("appointments")
      .select("id")
      .eq("barber_id", selectedBarber)
      .eq("appointment_date", dateStr)
      .eq("appointment_time", selectedTime)
      .in("status", ["confirmed", "completed"])
      .limit(1);

    if (existing && existing.length > 0) {
      toast.error("Este horário já está reservado para este barbeiro.");
      setSubmitting(false);
      return;
    }

    const { data: newAppt, error } = await supabase.from("appointments").insert({
      user_id: user.id,
      barber_id: selectedBarber,
      service_id: selectedService,
      appointment_date: dateStr,
      appointment_time: selectedTime,
      status: paymentMethod === "local" ? "confirmed" : "pending_payment",
      payment_status: paymentMethod === "local" ? "waived" : "pending",
      payment_method: paymentMethod,
      notes: notes || null,
    }).select("id").single();

    if (error || !newAppt) {
      toast.error("Erro ao agendar. Tente novamente.");
      setSubmitting(false);
      return;
    }

    // Send confirmation email
    try {
      await supabase.functions.invoke("send-booking-email", {
        body: {
          to: user.email,
          subject: "Confirmação de Agendamento - AutoBarber",
          appointment: {
            barber_name: selectedBarberData?.name,
            service_name: selectedServiceData?.name,
            date: format(selectedDate, "dd/MM/yyyy"),
            time: selectedTime,
            price: selectedServiceData?.price,
          },
        },
      });
    } catch (e) {
      console.error("Email error:", e);
    }

    // Sync with Google Calendar
    try {
      await supabase.functions.invoke("sync-google-calendar", {
        body: { appointment_id: newAppt.id },
      });
    } catch (e) {
      console.error("Calendar sync error:", e);
    }

    // If online payment, create Mercado Pago preference
    if (paymentMethod !== "local") {
      try {
        const { data: mpData } = await supabase.functions.invoke("create-payment", {
          body: {
            appointment_id: newAppt.id,
            service_name: selectedServiceData?.name,
            price: selectedServiceData?.price,
            payer_email: user.email,
          },
        });

        if (mpData?.init_point) {
          window.location.href = mpData.init_point;
          return;
        }
      } catch (e) {
        console.error("Payment error:", e);
        toast.error("Erro ao criar pagamento. Agendamento foi criado.");
      }
    }

    toast.success("Agendamento confirmado!");
    navigate("/appointments");
    setSubmitting(false);
  };

  const canDisableDate = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return true;
    // If barber has schedules, disable days without schedule
    if (schedules.length > 0) {
      const dow = date.getDay();
      return !schedules.some(s => s.day_of_week === dow);
    }
    return false;
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-display text-2xl text-center tracking-wider text-neon mb-6">AGENDAR</h1>
        <StepperBar steps={STEPS} currentStep={step} />

        {/* Step 0: Barber */}
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {barbers.map(b => (
              <GlassCard key={b.id} className={cn("cursor-pointer transition-all", selectedBarber === b.id && "border-2 border-primary shadow-elevated")}
                animate={false}>
                <button onClick={() => setSelectedBarber(b.id)} className="w-full text-left flex items-center gap-4">
                  {b.photo_url ? (
                    <img src={b.photo_url} alt={b.name} className="w-16 h-16 rounded-full object-cover border border-neon" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border border-neon">
                      <Scissors className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-display text-sm tracking-wider">{b.name}</p>
                    {b.specialties && <p className="text-xs text-muted-foreground">{b.specialties.join(" • ")}</p>}
                  </div>
                </button>
              </GlassCard>
            ))}
            {barbers.length === 0 && <p className="text-muted-foreground col-span-2 text-center">Nenhum barbeiro disponível</p>}
            <div className="col-span-full flex justify-end mt-4">
              <Button variant="neon" disabled={!selectedBarber} onClick={() => setStep(1)}>Próximo</Button>
            </div>
          </div>
        )}

        {/* Step 1: Service */}
        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {services.map(s => (
              <GlassCard key={s.id} className={cn("cursor-pointer transition-all", selectedService === s.id && "border-2 border-primary shadow-elevated")}
                animate={false}>
                <button onClick={() => setSelectedService(s.id)} className="w-full text-left">
                  <p className="font-display text-sm tracking-wider mb-1">{s.name}</p>
                  {s.description && <p className="text-xs text-muted-foreground mb-2">{s.description}</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.duration_minutes}min</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />R$ {Number(s.price).toFixed(2)}</span>
                  </div>
                </button>
              </GlassCard>
            ))}
            <div className="col-span-full flex justify-between mt-4">
              <Button variant="ghost" onClick={() => setStep(0)}>Voltar</Button>
              <Button variant="neon" disabled={!selectedService} onClick={() => setStep(2)}>Próximo</Button>
            </div>
          </div>
        )}

        {/* Step 2: Date */}
        {step === 2 && (
          <div className="flex flex-col items-center">
            <GlassCard animate={false} className="inline-block">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                disabled={canDisableDate}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </GlassCard>
            <div className="flex justify-between w-full max-w-md mt-6">
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <Button variant="neon" disabled={!selectedDate} onClick={() => setStep(3)}>Próximo</Button>
            </div>
          </div>
        )}

        {/* Step 3: Time */}
        {step === 3 && (
          <div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {timeSlots.map(slot => {
                const booked = bookedSlots.includes(slot);
                return (
                  <button key={slot} disabled={booked}
                    onClick={() => setSelectedTime(slot)}
                    className={cn(
                      "py-3 rounded-lg text-sm font-display tracking-wider transition-all border",
                      booked
                        ? "bg-muted/50 text-muted-foreground border-muted cursor-not-allowed line-through"
                        : selectedTime === slot
                          ? "bg-primary text-primary-foreground border-primary shadow-elevated"
                          : "bg-card border-neon hover:border-primary hover:shadow-elevated"
                    )}>
                    {slot}
                  </button>
                );
              })}
            </div>
            {timeSlots.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum horário disponível para esta data</p>}
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
              <Button variant="neon" disabled={!selectedTime} onClick={() => setStep(4)}>Próximo</Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <GlassCard animate={false}>
            <h2 className="font-display text-lg tracking-wider text-neon mb-4">RESUMO</h2>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between"><span className="text-muted-foreground">Barbeiro</span><span>{selectedBarberData?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span>{selectedServiceData?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Horário</span><span>{selectedTime}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="text-neon font-bold">R$ {selectedServiceData ? Number(selectedServiceData.price).toFixed(2) : "0.00"}</span></div>
              <hr className="border-border" />
              <div>
                <label className="text-muted-foreground text-xs block mb-1">Observações (opcional)</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma observação?" className="bg-muted/30" />
              </div>
              <div>
                <label className="text-muted-foreground text-xs block mb-2">Forma de pagamento</label>
                <div className="flex gap-3">
                  {[
                    { id: "local", label: "No local" },
                    { id: "pix", label: "PIX" },
                    { id: "card", label: "Cartão" },
                  ].map(pm => (
                    <button key={pm.id} onClick={() => setPaymentMethod(pm.id)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-display border transition-all",
                        paymentMethod === pm.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted text-muted-foreground hover:border-primary"
                      )}>
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>Voltar</Button>
              <Button variant="neon" onClick={handleConfirm} disabled={submitting}>
                {submitting ? "AGENDANDO..." : "CONFIRMAR AGENDAMENTO"}
              </Button>
            </div>
          </GlassCard>
        )}
      </main>
    </div>
  );
};

export default Booking;
