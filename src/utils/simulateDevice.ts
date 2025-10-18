import { supabase } from "@/integrations/supabase/client";

export async function simulateDevice() {
  try {
    // 1. Criar dispositivo de exemplo
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Usuário não autenticado");

    const deviceId = "ESP32-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const macAddress = Array.from({ length: 6 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':').toUpperCase();

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .insert({
        user_id: user.user.id,
        device_name: `T-Dongle Demo`,
        device_id: deviceId,
        mac_address: macAddress,
        firmware_version: "1.0.0-demo",
        is_online: true,
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (deviceError) throw deviceError;

    // 2. Criar status do dispositivo
    const statusPromises = Array.from({ length: 5 }, (_, i) => {
      const minutesAgo = i * 2;
      return supabase.from("device_status").insert({
        device_id: device.id,
        display_active: true,
        wifi_connected: true,
        usb_host_active: i < 3,
        transfer_active: i === 0,
        storage_used_mb: 1500 + (i * 100),
        total_backups: 5 - i,
        created_at: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
      });
    });

    await Promise.all(statusPromises);

    // 3. Criar backups de exemplo
    const backups = [
      { filename: "foto_familia_2025.jpg", size: 5.2, type: "image", dest: "\\\\SERVIDOR\\Fotos\\2025" },
      { filename: "projeto_trabalho.docx", size: 1.8, type: "document", dest: "\\\\SERVIDOR\\Documentos" },
      { filename: "video_aniversario.mp4", size: 245.6, type: "video", dest: "\\\\SERVIDOR\\Videos" },
      { filename: "apresentacao.pptx", size: 12.4, type: "document", dest: "\\\\SERVIDOR\\Trabalho" },
      { filename: "backup_fotos.zip", size: 512.3, type: "archive", dest: "\\\\SERVIDOR\\Backups" },
    ];

    const backupPromises = backups.map((backup, i) =>
      supabase.from("device_backups").insert({
        device_id: device.id,
        filename: backup.filename,
        file_size_mb: backup.size,
        backup_type: backup.type,
        status: i === 0 ? "pending" : "completed",
        destination: backup.dest,
        created_at: new Date(Date.now() - (i + 1) * 3600 * 1000).toISOString(),
      })
    );

    await Promise.all(backupPromises);

    // 4. Criar logs de exemplo
    const logs = [
      { level: "info", msg: "Sistema iniciado com sucesso" },
      { level: "info", msg: "WiFi conectado - SSID: MinhaCasa5G" },
      { level: "info", msg: "Pendrive detectado - Capacidade: 64GB" },
      { level: "warning", msg: "Armazenamento atingiu 80% da capacidade" },
      { level: "info", msg: `Backup iniciado: ${backups[0].filename}` },
      { level: "info", msg: `Transferência concluída: ${backups[1].filename} (${backups[1].size}MB)` },
      { level: "info", msg: `Transferência concluída: ${backups[2].filename} (${backups[2].size}MB)` },
      { level: "error", msg: "Erro ao conectar com \\\\SERVIDOR\\Temp - timeout" },
      { level: "info", msg: "Reconectando ao servidor de destino..." },
      { level: "info", msg: `Transferência concluída: ${backups[3].filename} (${backups[3].size}MB)` },
    ];

    const logPromises = logs.map((log, i) =>
      supabase.from("device_logs").insert({
        device_id: device.id,
        log_level: log.level,
        message: log.msg,
        created_at: new Date(Date.now() - (logs.length - i) * 300 * 1000).toISOString(),
      })
    );

    await Promise.all(logPromises);

    return { success: true, device };
  } catch (error) {
    console.error("Erro ao simular dispositivo:", error);
    throw error;
  }
}
