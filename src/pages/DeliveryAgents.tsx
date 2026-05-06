import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Bot, Copy, Check } from "lucide-react";
import { toast } from "sonner";

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function DeliveryAgents() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("delivery_agents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems(data || []);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Informe um nome"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const token = generateToken();
      const { data, error } = await supabase
        .from("delivery_agents")
        .insert({ user_id: user.id, name: name.trim(), agent_token: token })
        .select("id")
        .single();
      if (error) throw error;
      setRevealed((p) => ({ ...p, [data.id]: true }));
      setName("");
      toast.success("Agente criado. Copie o token agora.");
      fetchItems();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("delivery_agents").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); fetchItems(); }
  };

  const toggle = async (row: any) => {
    const { error } = await supabase
      .from("delivery_agents")
      .update({ enabled: !row.enabled })
      .eq("id", row.id);
    if (error) toast.error(error.message); else fetchItems();
  };

  const copy = async (id: string, token: string) => {
    await navigator.clipboard.writeText(token);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-7 w-7" /> Agentes de Entrega
        </h1>
        <p className="text-muted-foreground">
          Tokens usados pelo agente local (Python) que entrega backups da Cloud para o share SMB/NFS.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo agente</CardTitle>
          <CardDescription>
            O token completo é exibido apenas uma vez ao criar — guarde em local seguro.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Servidor sala-1" />
          </div>
          <Button onClick={handleCreate} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" /> Gerar token
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agentes registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Última atividade</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum agente</TableCell></TableRow>
              ) : items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {revealed[row.id]
                      ? <span className="break-all">{row.agent_token}</span>
                      : <span>{row.agent_token.slice(0, 6)}…{row.agent_token.slice(-4)}</span>}
                    <Button size="icon" variant="ghost" className="ml-2 h-6 w-6"
                      onClick={() => copy(row.id, row.agent_token)}>
                      {copied === row.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.last_seen_at ? new Date(row.last_seen_at).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch checked={row.enabled} onCheckedChange={() => toggle(row)} />
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
