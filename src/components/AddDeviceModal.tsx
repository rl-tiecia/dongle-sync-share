import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

interface AddDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeviceAdded: () => void;
}

export function AddDeviceModal({ open, onOpenChange, onDeviceAdded }: AddDeviceModalProps) {
  const [claimCode, setClaimCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClaim = async () => {
    if (!claimCode.trim()) {
      toast.error("Digite o código de vinculação");
      return;
    }

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
        .eq('claim_code', claimCode.toUpperCase().replace('-', ''))
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
      onDeviceAdded();
      onOpenChange(false);
      setClaimCode("");
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
            Digite o código de vinculação exibido no display do seu T-Dongle S3
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="claim-code">Código de Vinculação</Label>
            <Input
              id="claim-code"
              placeholder="XXXX-XXXX"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              maxLength={9}
              className="text-center text-lg font-mono"
            />
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Como vincular:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Ligue seu T-Dongle S3</li>
                  <li>Aguarde aparecer o código no display</li>
                  <li>Digite o código acima</li>
                  <li>Clique em "Vincular Dispositivo"</li>
                </ol>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleClaim} 
            disabled={loading || !claimCode.trim()}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
