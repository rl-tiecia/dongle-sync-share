import { StatusCard } from "@/components/StatusCard";
import { DeviceSelector } from "@/components/DeviceSelector";
import { DashboardCharts } from "@/components/DashboardCharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, Wifi, HardDrive, Clock, CheckCircle2, XCircle, Plus, Link, Upload } from "lucide-react";
import { useDevices, useDeviceStatus } from "@/hooks/useDevices";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { simulateDevice } from "@/utils/simulateDevice";
import { toast } from "sonner";
import { AddDeviceModal } from "@/components/AddDeviceModal";

const Dashboard = () => {
  const { devices, selectedDevice, setSelectedDevice, loading, refetch } = useDevices();
  const { status } = useDeviceStatus(selectedDevice?.id);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activeBackup, setActiveBackup] = useState<any | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);

  const fetchRecentActivity = async () => {
    if (!selectedDevice) return;
    const { data } = await supabase
      .from("device_logs")
      .select("*")
      .eq("device_id", selectedDevice.id)
      .order("created_at", { ascending: false })
      .limit(8);
    setRecentActivity(data || []);
  };

  const fetchActiveBackup = async () => {
    if (!selectedDevice) return;
    const { data } = await supabase
      .from("device_backups")
      .select("*")
      .eq("device_id", selectedDevice.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveBackup(data);
  };

  useEffect(() => {
    fetchRecentActivity();
    fetchActiveBackup();
  }, [selectedDevice?.id]);

  // Live device_logs stream — prepend new log without refetch, with dedup
  useRealtimeSubscription<any>({
    channel: `logs-${selectedDevice?.id ?? "none"}`,
    table: "device_logs",
    event: "INSERT",
    filter: selectedDevice ? `device_id=eq.${selectedDevice.id}` : undefined,
    enabled: !!selectedDevice,
    onChange: (payload) => {
      const row = payload.new;
      if (!row) return;
      setRecentActivity((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev;
        return [row, ...prev].slice(0, 8);
      });
    },
  });

  // Live backup progress — react to inserts and updates
  useRealtimeSubscription<any>({
    channel: `backups-live-${selectedDevice?.id ?? "none"}`,
    table: "device_backups",
    event: "*",
    filter: selectedDevice ? `device_id=eq.${selectedDevice.id}` : undefined,
    enabled: !!selectedDevice,
    onChange: () => fetchActiveBackup(),
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  const handleSimulateDevice = async () => {
    try {
      toast.loading("Criando dispositivo demo...");
      await simulateDevice();
      toast.success("Dispositivo demo criado com sucesso!");
    } catch (error) {
      toast.error("Erro ao criar dispositivo demo");
    }
  };

  if (devices.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real do T-Dongle S3
          </p>
        </div>
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-muted-foreground">
              Nenhum dispositivo registrado. Configure seu T-Dongle S3 para começar.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setShowAddDevice(true)}>
                <Link className="mr-2 h-4 w-4" />
                Adicionar Dispositivo
              </Button>
              <Button onClick={handleSimulateDevice} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Criar Dispositivo Demo
              </Button>
            </div>
          </CardContent>
        </Card>
        <AddDeviceModal 
          open={showAddDevice} 
          onOpenChange={setShowAddDevice}
          onDeviceAdded={refetch}
        />
      </div>
    );
  }

  const lastBackup = selectedDevice?.last_seen_at
    ? new Date(selectedDevice.last_seen_at).toLocaleString("pt-BR")
    : "N/A";
  const totalBackups = status?.total_backups || 0;
  const backupSize = status?.storage_used_mb 
    ? `${(status.storage_used_mb / 1024).toFixed(2)} GB`
    : "0 GB";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[var(--radius)] glass-card p-6 sm:p-8 animate-slide-up">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Painel Principal</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Olá, <span className="gradient-text">monitoramento ativo</span>
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Acompanhe em tempo real seus dispositivos T-Dongle S3, backups e entregas.
            </p>
          </div>
          <Button
            onClick={() => setShowAddDevice(true)}
            className="bg-gradient-primary hover:opacity-90 shadow-glow"
          >
            <Link className="mr-2 h-4 w-4" />
            Adicionar Dispositivo
          </Button>
        </div>
      </div>

      {/* Device Selector */}
      <DeviceSelector
        devices={devices}
        selectedDevice={selectedDevice}
        onDeviceSelect={setSelectedDevice}
        onDeviceUpdated={refetch}
      />

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="Status da Conexão"
          value={selectedDevice?.is_online ? "Online" : "Offline"}
          icon={Wifi}
          variant={selectedDevice?.is_online ? "success" : "warning"}
          subtitle={selectedDevice?.is_online ? "Conectado à rede" : "Dispositivo desconectado"}
        />
        <StatusCard
          title="Último Backup"
          value={lastBackup}
          icon={Clock}
          variant="info"
          subtitle="Transferido com sucesso"
        />
        <StatusCard
          title="Total de Backups"
          value={totalBackups}
          icon={HardDrive}
          variant="default"
          subtitle="Arquivos transferidos"
        />
        <StatusCard
          title="Espaço Utilizado"
          value={backupSize}
          icon={Activity}
          variant="default"
          subtitle="Armazenamento total"
        />
      </div>

      {activeBackup && (
        <Card className="border-info/30 bg-info/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-info animate-pulse" />
                <CardTitle className="text-base">Backup em andamento</CardTitle>
              </div>
              <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                Em tempo real
              </Badge>
            </div>
            <CardDescription className="font-mono text-xs">
              {activeBackup.filename}
              {activeBackup.file_size_mb ? ` • ${activeBackup.file_size_mb} MB` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={66} className="h-2 animate-pulse" />
            <p className="mt-2 text-xs text-muted-foreground">
              Iniciado em {new Date(activeBackup.created_at).toLocaleTimeString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Device Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status do Dispositivo</CardTitle>
            <CardDescription>Informações em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Display</span>
              <Badge 
                variant="outline" 
                className={status?.display_active 
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-muted text-muted-foreground"}
              >
                {status?.display_active ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                {status?.display_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WiFi</span>
              <Badge 
                variant="outline" 
                className={status?.wifi_connected 
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-muted text-muted-foreground"}
              >
                {status?.wifi_connected ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                {status?.wifi_connected ? "Conectado" : "Desconectado"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">USB Host</span>
              <Badge 
                variant="outline" 
                className={status?.usb_host_active 
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-muted text-muted-foreground"}
              >
                {status?.usb_host_active ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                {status?.usb_host_active ? "Detectando" : "Inativo"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Transferência Ativa</span>
              <Badge 
                variant="outline" 
                className={status?.transfer_active 
                  ? "bg-info/10 text-info border-info/20"
                  : "bg-muted text-muted-foreground"}
              >
                {status?.transfer_active ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                {status?.transfer_active ? "Transferindo" : "Aguardando"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Últimas operações realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma atividade recente
                </p>
              ) : (
                recentActivity.map((activity) => {
                  const timeAgo = new Date(activity.created_at).toLocaleString("pt-BR");
                  return (
                    <div key={activity.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            activity.log_level === "error"
                              ? "bg-destructive"
                              : activity.log_level === "warning"
                              ? "bg-warning"
                              : "bg-success"
                          }`}
                        />
                        <span>{activity.message}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">{timeAgo}</span>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <DashboardCharts deviceId={selectedDevice?.id} />

      <AddDeviceModal 
        open={showAddDevice} 
        onOpenChange={setShowAddDevice}
        onDeviceAdded={refetch}
      />
    </div>
  );
};

export default Dashboard;
