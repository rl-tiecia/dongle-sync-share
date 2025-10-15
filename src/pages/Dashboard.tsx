import { StatusCard } from "@/components/StatusCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Wifi, HardDrive, Clock, CheckCircle2, XCircle } from "lucide-react";

const Dashboard = () => {
  // Dados simulados - em produção viriam do dispositivo via API
  const isConnected = true;
  const lastBackup = "2024-01-15 14:23:00";
  const totalBackups = 127;
  const backupSize = "2.4 GB";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitoramento em tempo real do T-Dongle S3
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="Status da Conexão"
          value={isConnected ? "Online" : "Offline"}
          icon={Wifi}
          variant={isConnected ? "success" : "warning"}
          subtitle={isConnected ? "Conectado à rede" : "Dispositivo desconectado"}
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
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Ativo
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WiFi</span>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Conectado
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">USB Host</span>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Detectando
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Transferência Ativa</span>
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                <XCircle className="mr-1 h-3 w-3" />
                Aguardando
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
              {[
                { action: "Backup transferido", time: "há 2 horas", status: "success" },
                { action: "Arquivo detectado", time: "há 3 horas", status: "info" },
                { action: "Backup transferido", time: "há 5 horas", status: "success" },
                { action: "Dispositivo reiniciado", time: "há 8 horas", status: "warning" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        activity.status === "success"
                          ? "bg-success"
                          : activity.status === "info"
                          ? "bg-info"
                          : "bg-warning"
                      }`}
                    />
                    <span>{activity.action}</span>
                  </div>
                  <span className="text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
