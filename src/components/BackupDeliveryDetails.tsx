import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface Props {
  backup: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackupDeliveryDetails({ backup, open, onOpenChange }: Props) {
  const [attempts, setAttempts] = useState<any[]>([]);

  const fetchAttempts = async () => {
    if (!backup?.id) return;
    const { data } = await supabase
      .from("delivery_attempts")
      .select("*")
      .eq("backup_id", backup.id)
      .order("created_at", { ascending: false });
    setAttempts(data || []);
  };

  useEffect(() => { if (open) fetchAttempts(); }, [open, backup?.id]);

  useRealtimeSubscription({
    channel: `attempts-${backup?.id ?? "none"}`,
    table: "delivery_attempts",
    event: "*",
    filter: backup ? `backup_id=eq.${backup.id}` : undefined,
    enabled: open && !!backup,
    onChange: () => fetchAttempts(),
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      success: "bg-success/10 text-success border-success/20",
      error: "bg-destructive/10 text-destructive border-destructive/20",
      in_flight: "bg-primary/10 text-primary border-primary/20",
      cancelled: "bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={map[s] || ""}>{s}</Badge>;
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Tentativas de entrega</SheetTitle>
          <SheetDescription>
            {backup?.filename} — histórico completo de tentativas de envio para o destino de rede.
          </SheetDescription>
        </SheetHeader>

        {backup && (
          <div className="mt-4 mb-2 flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={`/logs?device=${backup.device_id}`}>
                <ExternalLink className="h-3 w-3 mr-1" />Ver logs do dispositivo
              </Link>
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Quando</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Próximo retry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Nenhuma tentativa registrada
                </TableCell>
              </TableRow>
            ) : attempts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.attempt_number}</TableCell>
                <TableCell>{fmt(a.created_at)}</TableCell>
                <TableCell>{statusBadge(a.status)}</TableCell>
                <TableCell className="font-mono text-xs">{a.error_code || "—"}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={a.error_message || a.delivered_path || ""}>
                  {a.error_message || a.delivered_path || "—"}
                </TableCell>
                <TableCell className="text-xs">{fmt(a.next_attempt_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SheetContent>
    </Sheet>
  );
}
