-- Add UPDATE and DELETE policies for device_status
CREATE POLICY "Users can update status of their devices"
ON device_status FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM devices 
  WHERE devices.id = device_status.device_id 
  AND devices.user_id = auth.uid()
));

CREATE POLICY "Users can delete status of their devices"
ON device_status FOR DELETE
USING (EXISTS (
  SELECT 1 FROM devices 
  WHERE devices.id = device_status.device_id 
  AND devices.user_id = auth.uid()
));

-- Add UPDATE and DELETE policies for device_backups
CREATE POLICY "Users can update backups of their devices"
ON device_backups FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM devices 
  WHERE devices.id = device_backups.device_id 
  AND devices.user_id = auth.uid()
));

CREATE POLICY "Users can delete backups of their devices"
ON device_backups FOR DELETE
USING (EXISTS (
  SELECT 1 FROM devices 
  WHERE devices.id = device_backups.device_id 
  AND devices.user_id = auth.uid()
));

-- Add UPDATE and DELETE policies for device_logs
CREATE POLICY "Users can update logs of their devices"
ON device_logs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM devices 
  WHERE devices.id = device_logs.device_id 
  AND devices.user_id = auth.uid()
));

CREATE POLICY "Users can delete logs of their devices"
ON device_logs FOR DELETE
USING (EXISTS (
  SELECT 1 FROM devices 
  WHERE devices.id = device_logs.device_id 
  AND devices.user_id = auth.uid()
));