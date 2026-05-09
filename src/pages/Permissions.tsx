import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Loader2, Play, Shield, Users as UsersIcon, MonitorCog, FileSearch, CheckCircle2, XCircle } from "lucide-react";
import { showSupabaseError } from "@/lib/supabaseError";
import { toast } from "sonner";
import { DeviceShareDialog } from "@/components/DeviceShareDialog";

type Profile = { id: string; email: string; full_name: string | null };
type Role = { user_id: string; role: string };
type Device = { id: string; device_name: string; device_id: string; user_id: string | null };
type Permission = { id: string; device_id: string; user_id: string; permission_level: string };
type AuditRow = {
  id: string; user_id: string | null; function_name: string;
  resource_type: string | null; resource_id: string | null;
  granted: boolean; reason: string | null; created_at: string;
};

export default function Permissions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" /> Roles & Permissões
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie papéis, compartilhamento de dispositivos, audite acessos e valide policies de RLS.
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="users"><UsersIcon className="h-4 w-4 mr-2" />Usuários</TabsTrigger>
          <TabsTrigger value="devices"><MonitorCog className="h-4 w-4 mr-2" />Dispositivos</TabsTrigger>
          <TabsTrigger value="audit"><FileSearch className="h-4 w-4 mr-2" />Auditoria</TabsTrigger>
          <TabsTrigger value="tests"><Play className="h-4 w-4 mr-2" />Testes RLS</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="devices"><DevicesTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
        <TabsContent value="tests"><RlsTestsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Map<string, string>>(new Map());
  const [devices, setDevices] = useState<Device[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [pr, rr, dr, perr] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("devices").select("id, device_name, device_id, user_id"),
        supabase.from("device_permissions").select("id, device_id, user_id, permission_level"),
      ]);
      if (pr.error) throw pr.error;
      if (rr.error) throw rr.error;
      if (dr.error) throw dr.error;
      if (perr.error) throw perr.error;
      setProfiles(pr.data ?? []);
      setRoles(new Map((rr.data ?? []).map((r: Role) => [r.user_id, r.role])));
      setDevices(dr.data ?? []);
      setPerms(perr.data ?? []);
    } catch (e) {
      showSupabaseError(e, "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []);

  const changeRole = async (userId: string, newRole: "admin" | "user") => {
    setSavingId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("update-user-role", {
        body: { target_user_id: userId, new_role: newRole },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      toast.success("Role atualizada");
      await reload();
    } catch (e) {
      showSupabaseError(e, "Erro ao atualizar role");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>;

  return (
    <Card className="p-4 mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Devices</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => {
            const role = roles.get(p.id) ?? "user";
            const owned = devices.filter((d) => d.user_id === p.id);
            const shared = perms.filter((pm) => pm.user_id === p.id);
            const isOpen = openId === p.id;
            return (
              <Collapsible key={p.id} asChild open={isOpen} onOpenChange={(o) => setOpenId(o ? p.id : null)}>
                <>
                  <TableRow>
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell className="font-medium">{p.email}</TableCell>
                    <TableCell>{p.full_name || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={role}
                        onValueChange={(v) => changeRole(p.id, v as "admin" | "user")}
                        disabled={savingId === p.id}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{owned.length} owned</Badge>{" "}
                      <Badge variant="outline">{shared.length} shared</Badge>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30">
                        <div className="space-y-3 py-2">
                          <div>
                            <div className="text-xs uppercase text-muted-foreground mb-1">Possui</div>
                            {owned.length === 0 ? <span className="text-sm text-muted-foreground">Nenhum</span> :
                              owned.map((d) => <Badge key={d.id} className="mr-1 mb-1">{d.device_name}</Badge>)}
                          </div>
                          <div>
                            <div className="text-xs uppercase text-muted-foreground mb-1">Compartilhado com ele</div>
                            {shared.length === 0 ? <span className="text-sm text-muted-foreground">Nenhum</span> :
                              shared.map((pm) => {
                                const d = devices.find((x) => x.id === pm.device_id);
                                return (
                                  <Badge key={pm.id} variant="outline" className="mr-1 mb-1">
                                    {d?.device_name ?? pm.device_id} · {pm.permission_level}
                                  </Badge>
                                );
                              })}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function DevicesTab() {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [perms, setPerms] = useState<Permission[]>([]);
  const [shareDevice, setShareDevice] = useState<Device | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [dr, pr, permR] = await Promise.all([
        supabase.from("devices").select("id, device_name, device_id, user_id").order("device_name"),
        supabase.from("profiles").select("*"),
        supabase.from("device_permissions").select("id, device_id, user_id, permission_level"),
      ]);
      if (dr.error) throw dr.error;
      if (pr.error) throw pr.error;
      if (permR.error) throw permR.error;
      setDevices(dr.data ?? []);
      setProfiles(new Map((pr.data ?? []).map((p: Profile) => [p.id, p])));
      setPerms(permR.data ?? []);
    } catch (e) {
      showSupabaseError(e, "Erro ao carregar dispositivos");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <Card className="p-4 mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dispositivo</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Compartilhado com</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => {
              const owner = d.user_id ? profiles.get(d.user_id) : null;
              const shares = perms.filter((p) => p.device_id === d.id);
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">{d.device_name}</div>
                    <div className="text-xs text-muted-foreground">{d.device_id}</div>
                  </TableCell>
                  <TableCell>{owner?.email ?? "—"}</TableCell>
                  <TableCell>
                    {shares.length === 0 ? <span className="text-sm text-muted-foreground">Nenhum</span> :
                      shares.map((s) => {
                        const u = profiles.get(s.user_id);
                        return (
                          <Badge key={s.id} variant="outline" className="mr-1 mb-1">
                            {u?.email ?? s.user_id.slice(0, 8)} · {s.permission_level}
                          </Badge>
                        );
                      })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setShareDevice(d)}>
                      Compartilhar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      {shareDevice && (
        <DeviceShareDialog
          open={!!shareDevice}
          onOpenChange={(o) => { if (!o) { setShareDevice(null); reload(); } }}
          deviceId={shareDevice.id}
          deviceName={shareDevice.device_name}
        />
      )}
    </>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFn, setFilterFn] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());

  const reload = async () => {
    setLoading(true);
    try {
      let q = supabase.from("access_audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (filterFn !== "all") q = q.eq("function_name", filterFn);
      if (filterStatus !== "all") q = q.eq("granted", filterStatus === "granted");
      const { data, error } = await q;
      if (error) throw error;
      setRows(data ?? []);
      const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id).filter(Boolean) as string[]));
      if (userIds.length) {
        const { data: ps } = await supabase.from("profiles").select("*").in("id", userIds);
        setProfiles(new Map((ps ?? []).map((p: Profile) => [p.id, p])));
      }
    } catch (e) {
      showSupabaseError(e, "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, [filterFn, filterStatus]);

  const visible = rows.filter((r) => {
    if (!search) return true;
    const u = r.user_id ? profiles.get(r.user_id)?.email ?? "" : "";
    return u.toLowerCase().includes(search.toLowerCase()) || (r.reason ?? "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Card className="p-4 mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar por email ou motivo..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filterFn} onValueChange={setFilterFn}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas funções</SelectItem>
            <SelectItem value="can_access_device">can_access_device</SelectItem>
            <SelectItem value="can_edit_device">can_edit_device</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="granted">Concedido</SelectItem>
            <SelectItem value="denied">Negado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={reload}>Atualizar</Button>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Recurso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro</TableCell></TableRow>
            )}
            {visible.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-xs">{r.user_id ? (profiles.get(r.user_id)?.email ?? r.user_id.slice(0, 8)) : "—"}</TableCell>
                <TableCell><Badge variant="outline">{r.function_name}</Badge></TableCell>
                <TableCell className="text-xs">{r.resource_type}/{r.resource_id?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell>
                  {r.granted
                    ? <Badge className="bg-success/15 text-success border-success/30">concedido</Badge>
                    : <Badge variant="destructive">negado</Badge>}
                </TableCell>
                <TableCell className="text-xs">{r.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function RlsTestsTab() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ passed: number; failed: number; total: number; cases: { name: string; passed: boolean; expected: unknown; actual: unknown; error?: string }[] } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("rls-test-suite", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setResult(data);
      if (data.failed === 0) toast.success(`${data.passed} de ${data.total} testes passaram`);
      else toast.error(`${data.failed} de ${data.total} testes falharam`);
    } catch (e) {
      showSupabaseError(e, "Erro ao executar testes");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="p-4 mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Bateria de testes de RLS</div>
          <div className="text-sm text-muted-foreground">
            Cria usuários temporários (admin/owner/editor/viewer/stranger), valida <code className="text-xs">has_role</code>, <code className="text-xs">can_access_device</code> e <code className="text-xs">can_edit_device</code> e limpa tudo ao final.
          </div>
        </div>
        <Button onClick={run} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Rodar testes
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Badge className="bg-success/15 text-success border-success/30">{result.passed} passaram</Badge>
            {result.failed > 0 && <Badge variant="destructive">{result.failed} falharam</Badge>}
            <Badge variant="outline">{result.total} total</Badge>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {result.cases.map((c, i) => (
              <div key={i} className={`p-3 rounded-md border ${c.passed ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                <div className="flex items-start gap-2">
                  {c.passed ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
                  <div className="text-sm font-medium">{c.name}</div>
                </div>
                {!c.passed && (
                  <div className="text-xs mt-2 text-muted-foreground font-mono">
                    esperado: {JSON.stringify(c.expected)}<br />
                    obtido: {JSON.stringify(c.actual)}
                    {c.error && <><br />erro: {c.error}</>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
