import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const Settings = () => {
  const handleSave = () => {
    toast.success("Configurações salvas com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Configure as opções de rede e funcionamento do dispositivo
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurações de Rede</CardTitle>
          <CardDescription>
            Configure a conexão WiFi e o destino dos backups
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="wifi-ssid">SSID da Rede WiFi</Label>
            <Input
              id="wifi-ssid"
              placeholder="Nome da rede WiFi"
              defaultValue="REDE_HOSPITAL"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wifi-password">Senha do WiFi</Label>
            <Input
              id="wifi-password"
              type="password"
              placeholder="••••••••"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="network-path">Pasta de Destino na Rede</Label>
            <Input
              id="network-path"
              placeholder="\\servidor\backups\maquina01"
              defaultValue="\\servidor\backups\maquina01"
            />
            <p className="text-xs text-muted-foreground">
              Caminho UNC para a pasta compartilhada onde os backups serão salvos
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Usuário da Rede</Label>
            <Input
              id="username"
              placeholder="usuario"
              defaultValue="admin"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha da Rede</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opções do Dispositivo</CardTitle>
          <CardDescription>
            Configure o comportamento do T-Dongle S3
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-transfer">Transferência Automática</Label>
              <p className="text-sm text-muted-foreground">
                Transferir automaticamente quando detectar novos arquivos
              </p>
            </div>
            <Switch id="auto-transfer" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="delete-after">Deletar Após Transferência</Label>
              <p className="text-sm text-muted-foreground">
                Remover arquivo do pendrive após transferência bem-sucedida
              </p>
            </div>
            <Switch id="delete-after" />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="display-enabled">Display Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Mostrar informações no display LCD do dispositivo
              </p>
            </div>
            <Switch id="display-enabled" defaultChecked />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="check-interval">Intervalo de Verificação (segundos)</Label>
            <Input
              id="check-interval"
              type="number"
              placeholder="5"
              defaultValue="5"
            />
            <p className="text-xs text-muted-foreground">
              Frequência de verificação de novos arquivos no pendrive
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline">Cancelar</Button>
        <Button onClick={handleSave}>Salvar Configurações</Button>
      </div>
    </div>
  );
};

export default Settings;
