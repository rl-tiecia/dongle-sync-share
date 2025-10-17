import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeviceSelector } from "@/components/DeviceSelector";
import { useDevices } from "@/hooks/useDevices";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Logs = () => {
  const { devices, selectedDevice, setSelectedDevice, loading } = useDevices();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedDevice) return;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from("device_logs")
        .select("*")
        .eq("device_id", selectedDevice.id)
        .order("created_at", { ascending: false })
        .limit(100);

      setLogs(data || []);
    };

    fetchLogs();

    const channel = supabase
      .channel(`logs-${selectedDevice.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "device_logs",
          filter: `device_id=eq.${selectedDevice.id}`,
        },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDevice]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "info":
        return <Badge variant="outline" className="bg-info/10 text-info border-info/20">INFO</Badge>;
      case "warning":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">WARNING</Badge>;
      case "error":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">ERROR</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logs do Sistema</h1>
        <p className="text-muted-foreground">
          Histórico de eventos e atividades do T-Dongle S3
        </p>
      </div>

      <DeviceSelector
        devices={devices}
        selectedDevice={selectedDevice}
        onDeviceSelect={setSelectedDevice}
      />

      <Card>
        <CardHeader>
          <CardTitle>Log de Atividades</CardTitle>
          <CardDescription>
            Registros detalhados de todas as operações realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full rounded-md border p-4">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum log disponível
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="mt-0.5">{getLevelBadge(log.log_level)}</div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-mono">{log.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Logs;
