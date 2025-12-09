import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Loader2, 
  MoreVertical, 
  Search, 
  Users, 
  Wifi, 
  WifiOff,
  Share2,
  Trash2
} from "lucide-react";
import { DeviceShareDialog } from "@/components/DeviceShareDialog";

interface DeviceWithOwner {
  id: string;
  device_id: string;
  device_name: string;
  is_online: boolean;
  is_claimed: boolean;
  user_id: string | null;
  created_at: string;
  last_seen_at: string | null;
  firmware_version: string | null;
  owner?: {
    email: string;
    full_name: string | null;
  };
  permissions_count: number;
}

interface DevicePermissionWithUser {
  id: string;
  user_id: string;
  permission_level: string;
  granted_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

export default function AdminDevices() {
  const [devices, setDevices] = useState<DeviceWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [devicePermissions, setDevicePermissions] = useState<DevicePermissionWithUser[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDeviceId, setShareDeviceId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDevices = async () => {
    try {
      // Buscar todos os dispositivos
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (devicesError) throw devicesError;

      // Buscar donos (profiles)
      const ownerIds = devicesData?.map(d => d.user_id).filter(Boolean) || [];
      const { data: ownersData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', ownerIds);

      const ownersMap = new Map(ownersData?.map(o => [o.id, o]) || []);

      // Buscar contagem de permissões por dispositivo
      const { data: permissionsData } = await supabase
        .from('device_permissions')
        .select('device_id');

      const permissionsCount = new Map<string, number>();
      permissionsData?.forEach(p => {
        const count = permissionsCount.get(p.device_id) || 0;
        permissionsCount.set(p.device_id, count + 1);
      });

      const devicesWithOwners: DeviceWithOwner[] = devicesData?.map(device => ({
        ...device,
        owner: device.user_id ? ownersMap.get(device.user_id) : undefined,
        permissions_count: permissionsCount.get(device.id) || 0,
      })) || [];

      setDevices(devicesWithOwners);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dispositivos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevicePermissions = async (deviceId: string) => {
    setPermissionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('device_permissions')
        .select(`
          id,
          user_id,
          permission_level,
          granted_at,
          profiles!device_permissions_user_id_fkey(email, full_name)
        `)
        .eq('device_id', deviceId);

      if (error) throw error;
      setDevicePermissions(data as DevicePermissionWithUser[] || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar permissões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleViewPermissions = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setPermissionsDialogOpen(true);
    fetchDevicePermissions(deviceId);
  };

  const handleRemovePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase
        .from('device_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      toast({
        title: "Permissão removida",
        description: "Acesso do usuário foi revogado",
      });

      if (selectedDeviceId) {
        fetchDevicePermissions(selectedDeviceId);
      }
      fetchDevices();
    } catch (error: any) {
      toast({
        title: "Erro ao remover permissão",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenShareDialog = (deviceId: string) => {
    setShareDeviceId(deviceId);
    setShareDialogOpen(true);
  };

  const filteredDevices = devices.filter(device => 
    device.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.owner?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Administração de Dispositivos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os dispositivos e suas permissões
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar dispositivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Device ID</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Compartilhado com</TableHead>
              <TableHead>Firmware</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDevices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum dispositivo encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredDevices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.device_name}</TableCell>
                  <TableCell className="font-mono text-xs">{device.device_id}</TableCell>
                  <TableCell>
                    {device.owner ? (
                      <div>
                        <div className="text-sm">{device.owner.full_name || device.owner.email}</div>
                        {device.owner.full_name && (
                          <div className="text-xs text-muted-foreground">{device.owner.email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Não vinculado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {device.is_online ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        <Wifi className="h-3 w-3 mr-1" />
                        Online
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <WifiOff className="h-3 w-3 mr-1" />
                        Offline
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {device.permissions_count > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPermissions(device.id)}
                        className="text-primary"
                      >
                        <Users className="h-4 w-4 mr-1" />
                        {device.permissions_count} usuário{device.permissions_count > 1 ? 's' : ''}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {device.firmware_version || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewPermissions(device.id)}>
                          <Users className="h-4 w-4 mr-2" />
                          Ver Permissões
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenShareDialog(device.id)}>
                          <Share2 className="h-4 w-4 mr-2" />
                          Compartilhar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog de Permissões do Dispositivo */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Permissões do Dispositivo</DialogTitle>
            <DialogDescription>
              {selectedDevice?.device_name} - Usuários com acesso
            </DialogDescription>
          </DialogHeader>
          
          {permissionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dono do dispositivo */}
              {selectedDevice?.owner && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{selectedDevice.owner.full_name || selectedDevice.owner.email}</div>
                      {selectedDevice.owner.full_name && (
                        <div className="text-sm text-muted-foreground">{selectedDevice.owner.email}</div>
                      )}
                    </div>
                    <Badge>Dono</Badge>
                  </div>
                </div>
              )}

              {/* Usuários com permissão */}
              {devicePermissions.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Usuários com acesso compartilhado</h4>
                  {devicePermissions.map((permission) => (
                    <div key={permission.id} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {permission.profiles?.full_name || permission.profiles?.email}
                        </div>
                        {permission.profiles?.full_name && (
                          <div className="text-sm text-muted-foreground">{permission.profiles.email}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {permission.permission_level === 'editor' ? 'Editor' : 'Visualizador'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemovePermission(permission.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Nenhum usuário com acesso compartilhado
                </div>
              )}

              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setPermissionsDialogOpen(false);
                  if (selectedDeviceId) {
                    handleOpenShareDialog(selectedDeviceId);
                  }
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Adicionar Usuário
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Compartilhamento */}
      {shareDeviceId && (
        <DeviceShareDialog
          deviceId={shareDeviceId}
          open={shareDialogOpen}
          onOpenChange={(open) => {
            setShareDialogOpen(open);
            if (!open) {
              setShareDeviceId(null);
              fetchDevices();
            }
          }}
        />
      )}
    </div>
  );
}
