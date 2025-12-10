import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardChartsProps {
  deviceId?: string;
}

interface BackupByDay {
  date: string;
  count: number;
  size: number;
}

interface StorageByType {
  type: string;
  size: number;
  count: number;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function DashboardCharts({ deviceId }: DashboardChartsProps) {
  const [loading, setLoading] = useState(true);
  const [backupsByDay, setBackupsByDay] = useState<BackupByDay[]>([]);
  const [storageByType, setStorageByType] = useState<StorageByType[]>([]);

  useEffect(() => {
    const fetchChartData = async () => {
      if (!deviceId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch backups for the last 7 days
        const endDate = new Date();
        const startDate = subDays(endDate, 6);

        const { data: backups } = await supabase
          .from("device_backups")
          .select("created_at, file_size_mb, backup_type")
          .eq("device_id", deviceId)
          .gte("created_at", startOfDay(startDate).toISOString())
          .order("created_at", { ascending: true });

        // Generate all days in range
        const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
        
        // Group backups by day
        const backupMap = new Map<string, { count: number; size: number }>();
        daysInRange.forEach(day => {
          const dateKey = format(day, "yyyy-MM-dd");
          backupMap.set(dateKey, { count: 0, size: 0 });
        });

        backups?.forEach(backup => {
          const dateKey = format(new Date(backup.created_at), "yyyy-MM-dd");
          const existing = backupMap.get(dateKey) || { count: 0, size: 0 };
          backupMap.set(dateKey, {
            count: existing.count + 1,
            size: existing.size + (backup.file_size_mb || 0),
          });
        });

        const backupsByDayData: BackupByDay[] = Array.from(backupMap.entries()).map(([date, data]) => ({
          date: format(new Date(date), "dd/MM", { locale: ptBR }),
          count: data.count,
          size: Math.round(data.size * 100) / 100,
        }));

        setBackupsByDay(backupsByDayData);

        // Group by backup type for pie chart
        const typeMap = new Map<string, { size: number; count: number }>();
        backups?.forEach(backup => {
          const type = backup.backup_type || "Outros";
          const existing = typeMap.get(type) || { size: 0, count: 0 };
          typeMap.set(type, {
            size: existing.size + (backup.file_size_mb || 0),
            count: existing.count + 1,
          });
        });

        const storageByTypeData: StorageByType[] = Array.from(typeMap.entries())
          .map(([type, data]) => ({
            type: type.charAt(0).toUpperCase() + type.slice(1),
            size: Math.round(data.size * 100) / 100,
            count: data.count,
          }))
          .sort((a, b) => b.size - a.size);

        setStorageByType(storageByTypeData);
      } catch (error) {
        console.error("Erro ao carregar dados dos gráficos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [deviceId]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasBackupData = backupsByDay.some(d => d.count > 0);
  const hasStorageData = storageByType.length > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Backup History Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Backups</CardTitle>
          <CardDescription>Backups realizados nos últimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasBackupData ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              Nenhum backup no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={backupsByDay} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(value: number, name: string) => [
                    name === "count" ? `${value} arquivos` : `${value} MB`,
                    name === "count" ? "Backups" : "Tamanho"
                  ]}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="count"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Storage Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Uso de Armazenamento</CardTitle>
          <CardDescription>Distribuição por tipo de arquivo (últimos 7 dias)</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasStorageData ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              Nenhum dado de armazenamento
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={storageByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="size"
                  >
                    {storageByType.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS[index % CHART_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(value: number) => [`${value} MB`, "Tamanho"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {storageByType.map((item, index) => (
                  <div key={item.type} className="flex items-center gap-2 text-sm">
                    <div 
                      className="h-3 w-3 rounded-full shrink-0" 
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="flex-1 truncate">{item.type}</span>
                    <span className="text-muted-foreground">{item.size} MB</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage Trend Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Tendência de Armazenamento</CardTitle>
          <CardDescription>Volume de dados transferidos por dia</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasBackupData ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              Nenhum dado de transferência
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={backupsByDay} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  tickFormatter={(value) => `${value} MB`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(value: number) => [`${value} MB`, "Transferido"]}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="size"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorSize)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
