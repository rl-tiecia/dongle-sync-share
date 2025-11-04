import { useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Device } from "@/hooks/useDevices";

interface DeviceActionsMenuProps {
  device: Device;
  onDeviceUpdated: () => void;
  onDeviceDeleted: () => void;
}

export function DeviceActionsMenu({ device, onDeviceUpdated, onDeviceDeleted }: DeviceActionsMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newName, setNewName] = useState(device.device_name);
  const [loading, setLoading] = useState(false);

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error("O nome não pode estar vazio");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({ device_name: newName.trim() })
        .eq("id", device.id);

      if (error) throw error;

      toast.success("Dispositivo renomeado com sucesso!");
      setShowEditDialog(false);
      onDeviceUpdated();
    } catch (error) {
      console.error("Erro ao renomear dispositivo:", error);
      toast.error("Erro ao renomear dispositivo");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("devices")
        .delete()
        .eq("id", device.id);

      if (error) throw error;

      toast.success("Dispositivo removido com sucesso!");
      setShowDeleteDialog(false);
      onDeviceDeleted();
    } catch (error) {
      console.error("Erro ao remover dispositivo:", error);
      toast.error("Erro ao remover dispositivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => {
            setNewName(device.device_name);
            setShowEditDialog(true);
          }}>
            <Pencil className="mr-2 h-4 w-4" />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Dispositivo</DialogTitle>
            <DialogDescription>
              Altere o nome do dispositivo para facilitar sua identificação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device-name">Nome do Dispositivo</Label>
              <Input
                id="device-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: T-Dongle Sala"
                maxLength={50}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Dispositivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{device.device_name}</strong>? 
              <br />
              Esta ação não pode ser desfeita e todos os dados associados (logs, backups, status) serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
