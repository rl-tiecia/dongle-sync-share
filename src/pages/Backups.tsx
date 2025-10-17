import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { DeviceSelector } from "@/components/DeviceSelector";
import { useDevices } from "@/hooks/useDevices";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Backups = () => {
  const { devices, selectedDevice, setSelectedDevice, loading } = useDevices();
  const [backups, setBackups] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedDevice) return;

    const fetchBackups = async () => {
      const { data } = await supabase
        .from("device_backups")
        .select("*")
        .eq("device_id", selectedDevice.id)
        .order("created_at", { ascending: false });

      setBackups(data || []);
    };

    fetchBackups();

    const channel = supabase
      .channel(`backups-${selectedDevice.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "device_backups",
          filter: `device_id=eq.${selectedDevice.id}`,
        },
        () => fetchBackups()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDevice]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Transferido
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            <Clock className="mr-1 h-3 w-3" />
            Pendente
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <AlertCircle className="mr-1 h-3 w-3" />
            Erro
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backups</h1>
        <p className="text-muted-foreground">
          Histórico de arquivos transferidos do pendrive para a rede
        </p>
      </div>

      <DeviceSelector
        devices={devices}
        selectedDevice={selectedDevice}
        onDeviceSelect={setSelectedDevice}
      />

      <Card>
        <CardHeader>
          <CardTitle>Arquivos de Backup</CardTitle>
          <CardDescription>
            Lista de todos os backups detectados e transferidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Arquivo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum backup registrado
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-medium">{backup.filename}</TableCell>
                    <TableCell>{backup.file_size_mb ? `${backup.file_size_mb} MB` : "N/A"}</TableCell>
                    <TableCell>{new Date(backup.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="font-mono text-xs">{backup.destination || "N/A"}</TableCell>
                    <TableCell>{getStatusBadge(backup.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Backups;
