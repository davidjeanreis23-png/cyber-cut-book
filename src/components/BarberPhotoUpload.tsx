import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BarberPhotoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

const MAX_BYTES = 3 * 1024 * 1024; // 3MB

const BarberPhotoUpload = ({ value, onChange }: BarberPhotoUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagem muito grande (máx 3MB)");
      return;
    }

    // Preview imediato
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("barbers").upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (error) {
      console.error("[BarberPhotoUpload] upload error:", error);
      toast.error(`Erro ao enviar imagem: ${error.message}`);
      setUploading(false);
      setPreview(value);
      return;
    }

    const { data } = supabase.storage.from("barbers").getPublicUrl(filename);
    onChange(data.publicUrl);
    setPreview(data.publicUrl);
    setUploading(false);
    toast.success("Foto enviada");
  };

  const remove = () => {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "w-20 h-20 rounded-full border-2 border-primary/40 flex items-center justify-center overflow-hidden bg-muted/40 shrink-0",
          uploading && "opacity-60"
        )}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="neon-outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {preview ? "Trocar foto" : "Enviar foto"}
          </Button>
          {preview && !uploading && (
            <Button type="button" variant="ghost" size="sm" onClick={remove}>
              <X className="h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">JPG/PNG até 3MB</p>
      </div>
    </div>
  );
};

export default BarberPhotoUpload;
