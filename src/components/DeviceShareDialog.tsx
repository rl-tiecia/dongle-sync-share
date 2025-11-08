import { useState } from "react";
import { Device } from "@/hooks/useDevices";
import { useDevicePermissions } from "@/hooks/useDevicePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface DeviceShareDialogProps {
  device: Device;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceShareDialog({ device, open, onOpenChange }: DeviceShareDialogProps) {
  const { permissions, loading, addPermission, removePermission } = useDevicePermissions(device.id);
  const { isAdmin } = useUserRole();
  const [newUserEmail, setNewUserEmail] = useState("");
  const [permissionLevel, setPermissionLevel] = useState<'viewer' | 'editor'>('viewer');
  const [adding, setAdding] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID
  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  });

  const isOwner = device.user_id === currentUserId;
  const canManagePermissions = isOwner || isAdmin;

  const handleAddPermission = async () => {
    if (!newUserEmail.trim()) {
      toast.error("Digite um email válido");
      return;
    }

    setAdding(true);
    try {
      await addPermission(newUserEmail, permissionLevel);
      toast.success("Permissão adicionada com sucesso");
      setNewUserEmail("");
      setPermissionLevel('viewer');
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar permissão");
    } finally {
      setAdding(false);
    }
  };

  const handleRemovePermission = async (permissionId: string) => {
    try {
      await removePermission(permissionId);
      toast.success("Permissão removida");
    } catch (error) {
      toast.error("Erro ao remover permissão");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Compartilhar Dispositivo</DialogTitle>
          <DialogDescription>
            Gerencie quem tem acesso ao dispositivo "{device.device_name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {canManagePermissions && (
            <div className="space-y-3 border-b pb-4">
              <Label>Adicionar Usuário</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="email@exemplo.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  type="email"
                />
                <Select
                  value={permissionLevel}
                  onValueChange={(v: 'viewer' | 'editor') => setPermissionLevel(v)}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddPermission}
                disabled={adding || !newUserEmail.trim()}
                className="w-full"
                size="sm"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Permissão
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>Usuários com Acesso</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum compartilhamento ativo
              </p>
            ) : (
              <div className="space-y-2">
                {permissions.map((perm) => (
                  <div
                    key={perm.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {perm.profiles?.email}
                      </p>
                      {perm.profiles?.full_name && (
                        <p className="text-xs text-muted-foreground">
                          {perm.profiles.full_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={perm.permission_level === 'editor' ? 'default' : 'secondary'}>
                        {perm.permission_level === 'viewer' ? 'Visualizador' : 'Editor'}
                      </Badge>
                      {canManagePermissions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePermission(perm.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
