import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const Logs = () => {
  // Dados simulados
  const logs = [
    {
      id: 1,
      timestamp: "2024-01-15 14:23:45",
      level: "info",
      message: "Arquivo backup_20240115_1423.dat transferido com sucesso",
    },
    {
      id: 2,
      timestamp: "2024-01-15 14:23:30",
      level: "info",
      message: "Iniciando transferência para \\\\servidor\\backups\\maquina01",
    },
    {
      id: 3,
      timestamp: "2024-01-15 14:23:15",
      level: "info",
      message: "Novo arquivo detectado: backup_20240115_1423.dat (125.4 MB)",
    },
    {
      id: 4,
      timestamp: "2024-01-15 14:23:10",
      level: "info",
      message: "Pendrive detectado na porta USB",
    },
    {
      id: 5,
      timestamp: "2024-01-15 10:15:52",
      level: "info",
      message: "Arquivo backup_20240115_1015.dat transferido com sucesso",
    },
    {
      id: 6,
      timestamp: "2024-01-15 10:15:35",
      level: "info",
      message: "Novo arquivo detectado: backup_20240115_1015.dat (122.8 MB)",
    },
    {
      id: 7,
      timestamp: "2024-01-14 18:45:23",
      level: "error",
      message: "Erro ao transferir arquivo: Rede não disponível",
    },
    {
      id: 8,
      timestamp: "2024-01-14 18:45:10",
      level: "warning",
      message: "Tentando reconexão com a rede (tentativa 3/3)",
    },
    {
      id: 9,
      timestamp: "2024-01-14 18:44:45",
      level: "warning",
      message: "Falha na conexão de rede, tentando novamente...",
    },
    {
      id: 10,
      timestamp: "2024-01-14 16:30:15",
      level: "info",
      message: "Display atualizado: Transfer Complete",
    },
  ];

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

      <Card>
        <CardHeader>
          <CardTitle>Log de Atividades</CardTitle>
          <CardDescription>
            Registros detalhados de todas as operações realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full rounded-md border p-4">
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="mt-0.5">{getLevelBadge(log.level)}</div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-mono">{log.message}</p>
                    <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Logs;
