import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Network } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  protocol: z.enum(["smb", "nfs"]),
  host: z.string().trim().min(1).max(253),
  share: z.string().trim().min(1).max(200),
  remote_path: z.string().trim().max(500).default("/"),
  username: z.string().max(120).optional().or(z.literal("")),
  password: z.string().max(200).optional().or(z.literal("")),
  domain: z.string().max(80).optional().or(z.literal("")),
  port: z.coerce.number().int().min(1).max(65535).optional().or(z.nan()),
  enabled: z.boolean(),
  is_default: z.boolean(),
});

type FormState = z.infer<typeof schema>;

const empty: FormState = {
  name: "", protocol: "smb", host: "", share: "", remote_path: "/",
  username: "", password: "", domain: "", port: undefined as any,
  enabled: true, is_default: false,
};

export default function NetworkDestinations() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("network_destinations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems(data || []);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error("Verifique os campos: " + parsed.error.issues.map(i => i.message).join(", "));
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = {
        ...parsed.data,
        port: Number.isFinite(parsed.data.port as number) ? parsed.data.port : null,
        user_id: user.id,
      };
      const { error } = await supabase.from("network_destinations").insert(payload);
      if (error) throw error;
      toast.success("Destino criado");
      setForm(empty);
      fetchItems();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("network_destinations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); fetchItems(); }
  };

  const toggleEnabled = async (row: any) => {
    const { error } = await supabase
      .from("network_destinations")
      .update({ enabled: !row.enabled })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else fetchItems();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Network className="h-7 w-7" /> Destinos de Rede
        </h1>
        <p className="text-muted-foreground">
          Configure compartilhamentos SMB ou NFS para onde os arquivos de backup serão entregues.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo destino</CardTitle>
          <CardDescription>
            Os backups primeiro vão para a Lovable Cloud (download direto pelo painel) e depois
            podem ser entregues automaticamente ao share configurado por um agente local.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Servidor de Backups" />
          </div>
          <div className="space-y-2">
            <Label>Protocolo</Label>
            <Select value={form.protocol} onValueChange={(v: "smb" | "nfs") => setForm({ ...form, protocol: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smb">SMB / CIFS (Windows Share)</SelectItem>
                <SelectItem value="nfs">NFS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Host / IP</Label>
            <Input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.10 ou fileserver.local" />
          </div>
          <div className="space-y-2">
            <Label>Share</Label>
            <Input value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} placeholder="backups" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Caminho dentro do share</Label>
            <Input value={form.remote_path} onChange={e => setForm({ ...form, remote_path: e.target.value })} placeholder="/dongles/" />
          </div>
          {form.protocol === "smb" && (
            <>
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input value={form.username || ""} onChange={e => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={form.password || ""} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Domínio (opcional)</Label>
                <Input value={form.domain || ""} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="WORKGROUP" />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Porta (opcional)</Label>
            <Input type="number" value={form.port as any || ""} onChange={e => setForm({ ...form, port: Number(e.target.value) as any })} placeholder={form.protocol === "smb" ? "445" : "2049"} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            <Label>Habilitado</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
            <Label>Destino padrão</Label>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar destino
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destinos configurados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Caminho</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum destino</TableCell></TableRow>
              ) : items.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="uppercase">{row.protocol}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.protocol === "smb"
                      ? `\\\\${row.host}\\${row.share}${row.remote_path}`
                      : `${row.host}:${row.share}${row.remote_path}`}
                  </TableCell>
                  <TableCell>{row.is_default ? "Sim" : "Não"}</TableCell>
                  <TableCell>
                    <Switch checked={row.enabled} onCheckedChange={() => toggleEnabled(row)} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(row.id)}>
                      <Trash2 className="h-4 w-4" />
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
}
