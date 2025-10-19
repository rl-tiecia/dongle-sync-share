import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const claimCodeSchema = z.object({
  claimCode: z.string()
    .min(1, "Digite o código de vinculação")
    .regex(/^[A-F0-9]{12}$/i, "Código deve ter 12 caracteres hexadecimais (endereço MAC)")
    .transform(s => s.toUpperCase())
});

interface AddDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeviceAdded: () => void;
}

export function AddDeviceModal({ open, onOpenChange, onDeviceAdded }: AddDeviceModalProps) {
  const [loading, setLoading] = useState(false);
  
  const form = useForm<z.infer<typeof claimCodeSchema>>({
    resolver: zodResolver(claimCodeSchema),
    defaultValues: {
      claimCode: ""
    }
  });

  const handleClaim = async (values: z.infer<typeof claimCodeSchema>) => {
    const cleanCode = values.claimCode.replace(/[^A-F0-9]/gi, '').toUpperCase();

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      // Buscar dispositivo com este claim code
      const { data: devices, error: searchError } = await supabase
        .from('devices')
        .select('*')
        .eq('claim_code', cleanCode)
        .eq('is_claimed', false)
        .is('user_id', null);

      if (searchError) {
        console.error("Erro ao buscar dispositivo:", searchError);
        toast.error("Erro ao buscar dispositivo");
        return;
      }

      if (!devices || devices.length === 0) {
        toast.error("Código inválido ou já utilizado");
        return;
      }

      const device = devices[0];

      // Gerar token único para o dispositivo
      const deviceToken = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

      // Vincular dispositivo ao usuário
      const { error: updateError } = await supabase
        .from('devices')
        .update({
          user_id: user.id,
          is_claimed: true,
          claimed_at: new Date().toISOString(),
          device_token: deviceToken
        })
        .eq('id', device.id);

      if (updateError) {
        console.error("Erro ao vincular dispositivo:", updateError);
        toast.error("Erro ao vincular dispositivo");
        return;
      }

      toast.success("Dispositivo vinculado com sucesso!");
      form.reset();
      onDeviceAdded();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao vincular dispositivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Dispositivo</DialogTitle>
          <DialogDescription>
            Digite o endereço MAC exibido no display do T-Dongle S3 (12 caracteres hexadecimais)
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleClaim)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="claimCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de Vinculação (MAC Address)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="A1B2C3D4E5F6"
                      className="text-center text-lg font-mono uppercase"
                      maxLength={17}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Como vincular:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Ligue seu T-Dongle S3</li>
                    <li>Aguarde aparecer o endereço MAC no display</li>
                    <li>Digite os 12 caracteres hexadecimais acima</li>
                    <li>Clique em "Vincular Dispositivo"</li>
                  </ol>
                </div>
              </div>
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vinculando...
                </>
              ) : (
                "Vincular Dispositivo"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
