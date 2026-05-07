import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, AlertCircle, Download, ShieldCheck, ShieldAlert, UploadCloud, Network, RefreshCw, XCircle, Ban, PlayCircle, ListTree } from "lucide-react";
import { DeviceSelector } from "@/components/DeviceSelector";
import { useDevices } from "@/hooks/useDevices";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { toast } from "sonner";
import { BackupDeliveryDetails } from "@/components/BackupDeliveryDetails";

const Backups = () => {
  const { devices, selectedDevice, setSelectedDevice, loading, refetch } = useDevices();
  const [backups, setBackups] = useState<any[]>([]);
  const [detailsBackup, setDetailsBackup] = useState<any | null>(null);

  const cancelDelivery = async (b: any) => {
    const { error } = await supabase.from("device_backups").update({
      delivery_status: "cancelled",
      delivery_next_attempt_at: null,
    }).eq("id", b.id);
    if (error) { toast.error("Falha ao cancelar"); return; }
    await supabase.from("delivery_attempts").insert({
      backup_id: b.id, attempt_number: b.delivery_attempts ?? 0, status: "cancelled",
    });
    toast.success("Entrega cancelada");
    fetchBackups();
  };

  const reactivateDelivery = async (b: any) => {
    const { error } = await supabase.from("device_backups").update({
      delivery_status: "pending",
      delivery_next_attempt_at: new Date().toISOString(),
      delivery_error: null,
      delivery_error_code: null,
    }).eq("id", b.id);
    if (error) { toast.error("Falha ao reativar"); return; }
    toast.success("Entrega reativada");
    fetchBackups();
  };

  const fetchBackups = async () => {
    if (!selectedDevice) return;
    const { data } = await supabase
      .from("device_backups")
      .select("*")
      .eq("device_id", selectedDevice.id)
      .order("created_at", { ascending: false });
    setBackups(data || []);
  };

  useEffect(() => { fetchBackups(); }, [selectedDevice?.id]);

  useRealtimeSubscription({
    channel: `backups-${selectedDevice?.id ?? "none"}`,
    table: "device_backups",
    event: "*",
    filter: selectedDevice ? `device_id=eq.${selectedDevice.id}` : undefined,
    enabled: !!selectedDevice,
    onChange: () => fetchBackups(),
  });

  const handleDownload = async (backup: any) => {
    if (!backup.storage_path) {
      toast.error("Arquivo não disponível");
      return;
    }
    const { data, error } = await supabase.storage
      .from("device-backups")
      .createSignedUrl(backup.storage_path, 300);
    if (error || !data) { toast.error("Falha ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const formatDuration = (ms: number | null) => {
    if (!ms || ms < 0) return "—";
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20"><CheckCircle2 className="mr-1 h-3 w-3" />Concluído</Badge>;
      case "uploading":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20"><UploadCloud className="mr-1 h-3 w-3" />Enviando</Badge>;
      case "verifying":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20"><Clock className="mr-1 h-3 w-3" />Verificando</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><AlertCircle className="mr-1 h-3 w-3" />Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const deliveryBadge = (b: any) => {
    const s = b.delivery_status as string | undefined;
    const tooltip = b.delivery_error ? ` (${b.delivery_error_code ?? "ERR"}: ${b.delivery_error})` : "";
    switch (s) {
      case "delivered":
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20" title={b.delivered_path ?? ""}>
          <Network className="mr-1 h-3 w-3" />Entregue
        </Badge>;
      case "in_flight":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <UploadCloud className="mr-1 h-3 w-3" />Entregando
        </Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          <Clock className="mr-1 h-3 w-3" />Aguardando agente
        </Badge>;
      case "retry":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20" title={tooltip}>
          <RefreshCw className="mr-1 h-3 w-3" />Tentando ({b.delivery_attempts ?? 0})
        </Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20" title={tooltip}>
          <XCircle className="mr-1 h-3 w-3" />{b.delivery_error_code ?? "Falhou"}
        </Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-muted text-muted-foreground">
          <Ban className="mr-1 h-3 w-3" />Cancelada
        </Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };
  if (loading) return <div className="flex items-center justify-center h-64">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backups</h1>
        <p className="text-muted-foreground">Histórico de arquivos enviados pelo dongle</p>
      </div>

      <DeviceSelector
        devices={devices}
        selectedDevice={selectedDevice}
        onDeviceSelect={setSelectedDevice}
        onDeviceUpdated={refetch}
      />

      <Card>
        <CardHeader>
          <CardTitle>Arquivos de Backup</CardTitle>
          <CardDescription>
            Download direto do storage da Cloud, com validação de integridade MD5.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Integridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrega rede</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum backup registrado
                  </TableCell>
                </TableRow>
              ) : backups.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <div>{b.filename}</div>
                    {b.status === "uploading" && (
                      <Progress value={b.progress ?? 0} className="h-1 mt-1" />
                    )}
                    {b.md5_hash && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        md5: {b.md5_hash.slice(0, 16)}…
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{b.file_size_mb ? `${Number(b.file_size_mb).toFixed(2)} MB` : "—"}</TableCell>
                  <TableCell>{formatDuration(b.duration_ms)}</TableCell>
                  <TableCell>{new Date(b.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    {b.integrity_verified ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        <ShieldCheck className="mr-1 h-3 w-3" />OK
                      </Badge>
                    ) : b.status === "completed" ? (
                      <Badge variant="outline">—</Badge>
                    ) : b.status === "failed" ? (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        <ShieldAlert className="mr-1 h-3 w-3" />Falhou
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                  <TableCell>{deliveryBadge(b)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(b)}
                      disabled={!b.storage_path || b.status !== "completed"}
                    >
                      <Download className="h-3 w-3 mr-1" /> Baixar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Backups;
