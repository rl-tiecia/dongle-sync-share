import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

const Backups = () => {
  // Dados simulados
  const backups = [
    {
      id: 1,
      filename: "backup_20240115_1423.dat",
      size: "125.4 MB",
      date: "2024-01-15 14:23:00",
      status: "success",
      destination: "\\\\servidor\\backups\\maquina01",
    },
    {
      id: 2,
      filename: "backup_20240115_1015.dat",
      size: "122.8 MB",
      date: "2024-01-15 10:15:00",
      status: "success",
      destination: "\\\\servidor\\backups\\maquina01",
    },
    {
      id: 3,
      filename: "backup_20240114_1630.dat",
      size: "128.1 MB",
      date: "2024-01-14 16:30:00",
      status: "success",
      destination: "\\\\servidor\\backups\\maquina01",
    },
    {
      id: 4,
      filename: "backup_20240114_1200.dat",
      size: "124.5 MB",
      date: "2024-01-14 12:00:00",
      status: "pending",
      destination: "\\\\servidor\\backups\\maquina01",
    },
    {
      id: 5,
      filename: "backup_20240113_1845.dat",
      size: "127.2 MB",
      date: "2024-01-13 18:45:00",
      status: "error",
      destination: "\\\\servidor\\backups\\maquina01",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
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
      case "error":
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
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-medium">{backup.filename}</TableCell>
                  <TableCell>{backup.size}</TableCell>
                  <TableCell>{backup.date}</TableCell>
                  <TableCell className="font-mono text-xs">{backup.destination}</TableCell>
                  <TableCell>{getStatusBadge(backup.status)}</TableCell>
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
