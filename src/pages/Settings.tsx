import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Download } from "lucide-react";
import { generateESP32Code } from "@/utils/generateESP32Code";
import { supabase } from "@/integrations/supabase/client";

const settingsSchema = z.object({
  wifiSsid: z.string()
    .min(1, "SSID não pode estar vazio")
    .max(32, "SSID deve ter no máximo 32 caracteres")
    .regex(/^[\x20-\x7E]+$/, "SSID contém caracteres inválidos"),
  wifiPassword: z.string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(63, "Senha deve ter no máximo 63 caracteres"),
  networkPath: z.string()
    .min(1, "Caminho de rede não pode estar vazio")
    .regex(/^\\\\[\w.-]+\\[\w\\.-]+/, "Formato de caminho UNC inválido (deve ser \\\\servidor\\pasta)"),
  username: z.string()
    .min(1, "Usuário não pode estar vazio")
    .max(100, "Usuário deve ter no máximo 100 caracteres"),
  password: z.string()
    .min(1, "Senha não pode estar vazia")
    .max(100, "Senha deve ter no máximo 100 caracteres"),
  checkInterval: z.coerce.number()
    .int("Intervalo deve ser um número inteiro")
    .min(1, "Intervalo deve ser pelo menos 1 segundo")
    .max(3600, "Intervalo não pode exceder 1 hora (3600 segundos)"),
  autoTransfer: z.boolean(),
  deleteAfter: z.boolean(),
  displayEnabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings = () => {
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      wifiSsid: "REDE_HOSPITAL",
      wifiPassword: "",
      networkPath: "\\\\servidor\\backups\\maquina01",
      username: "admin",
      password: "",
      checkInterval: 5,
      autoTransfer: true,
      deleteAfter: false,
      displayEnabled: true,
    },
  });

  const handleSave = (data: SettingsFormValues) => {
    console.log("Validated settings:", data);
    toast.success("Configurações salvas com sucesso!");
  };

  const handleDownloadCode = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error("Corrija os erros no formulário antes de baixar o código");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const formValues = form.getValues();

      // Gerar código ESP32 (claim code será o MAC do próprio dispositivo)
      const code = generateESP32Code({
        wifiSsid: formValues.wifiSsid,
        wifiPassword: formValues.wifiPassword,
        networkPath: formValues.networkPath,
        username: formValues.username,
        password: formValues.password,
        checkInterval: formValues.checkInterval,
        deleteAfter: formValues.deleteAfter,
        displayEnabled: formValues.displayEnabled,
      });

      // Download do arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `T-Dongle-S3-${timestamp}.ino`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Firmware gerado! O código de vinculação será o endereço MAC exibido no display.", {
        duration: 8000,
        description: "Carregue o arquivo no Arduino IDE e grave no ESP32"
      });
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao baixar código");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
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
            <FormField
              control={form.control}
              name="wifiSsid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SSID da Rede WiFi</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da rede WiFi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="wifiPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha do WiFi</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="networkPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pasta de Destino na Rede</FormLabel>
                  <FormControl>
                    <Input placeholder="\\servidor\backups\maquina01" {...field} />
                  </FormControl>
                  <FormDescription>
                    Caminho UNC para a pasta compartilhada onde os backups serão salvos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário da Rede</FormLabel>
                  <FormControl>
                    <Input placeholder="usuario" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha da Rede</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <FormField
              control={form.control}
              name="autoTransfer"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Transferência Automática</FormLabel>
                    <FormDescription>
                      Transferir automaticamente quando detectar novos arquivos
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="deleteAfter"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Deletar Após Transferência</FormLabel>
                    <FormDescription>
                      Remover arquivo do pendrive após transferência bem-sucedida
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="displayEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Display Ativo</FormLabel>
                    <FormDescription>
                      Mostrar informações no display LCD do dispositivo
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="checkInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Intervalo de Verificação (segundos)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5" {...field} />
                  </FormControl>
                  <FormDescription>
                    Frequência de verificação de novos arquivos no pendrive
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Código para ESP32</CardTitle>
            <CardDescription>
              Baixe o firmware pré-configurado. IMPORTANTE: Antes de gravar, verifique os 
              pinos do display no código gerado (linhas 50-95) e ajuste conforme o 
              esquemático do seu T-Dongle-S3. Se o dispositivo reiniciar infinitamente, 
              descomente a linha DEBUG_MODE_NO_DISPLAY para testar sem display.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <p className="font-medium">Instruções:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Preencha as configurações acima</li>
                <li>Clique em "Baixar Código para ESP32"</li>
                <li>Abra o arquivo .ino no Arduino IDE</li>
                <li>Conecte seu T-Dongle S3 via USB</li>
                <li>Selecione a placa "ESP32-S3 Dev Module"</li>
                <li>Compile e grave o firmware</li>
                <li>O endereço MAC (12 caracteres hexadecimais) aparecerá no display - use-o para vincular o dispositivo</li>
              </ol>
            </div>
            <Button 
              type="button" 
              onClick={handleDownloadCode}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Código para ESP32
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Cancelar
          </Button>
          <Button type="submit">Salvar Configurações</Button>
        </div>
      </form>
    </Form>
  );
};

export default Settings;
