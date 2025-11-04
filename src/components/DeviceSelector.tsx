import { Device } from "@/hooks/useDevices";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";
import { DeviceActionsMenu } from "./DeviceActionsMenu";

interface DeviceSelectorProps {
  devices: Device[];
  selectedDevice: Device | null;
  onDeviceSelect: (device: Device) => void;
  onDeviceUpdated: () => void;
}

export function DeviceSelector({
  devices,
  selectedDevice,
  onDeviceSelect,
  onDeviceUpdated,
}: DeviceSelectorProps) {
  const handleDeviceDeleted = () => {
    // Refresh will be triggered by realtime subscription in useDevices
    onDeviceUpdated();
  };
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
      <div className="flex-1">
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Selecionar Dispositivo
        </label>
        <Select
          value={selectedDevice?.id}
          onValueChange={(value) => {
            const device = devices.find((d) => d.id === value);
            if (device) onDeviceSelect(device);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um dispositivo" />
          </SelectTrigger>
          <SelectContent>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                <div className="flex items-center gap-2">
                  {device.is_online ? (
                    <Wifi className="h-4 w-4 text-success" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  {device.device_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {selectedDevice && (
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge
                variant="outline"
                className={
                  selectedDevice.is_online
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-muted text-muted-foreground"
                }
              >
                {selectedDevice.is_online ? "Online" : "Offline"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">ID:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {selectedDevice.device_id}
              </code>
            </div>
          </div>
          <DeviceActionsMenu
            device={selectedDevice}
            onDeviceUpdated={onDeviceUpdated}
            onDeviceDeleted={handleDeviceDeleted}
          />
        </div>
      )}
    </div>
  );
}
