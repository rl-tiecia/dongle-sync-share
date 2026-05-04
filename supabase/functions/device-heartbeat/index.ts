import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

const VALID_LOG_LEVELS = ['info', 'warn', 'error', 'debug']
const VALID_BACKUP_TYPES = ['auto', 'manual', 'scheduled']
const VALID_BACKUP_STATUS = ['completed', 'failed', 'in_progress']

const isFiniteNumber = (n: unknown, min = 0, max = 1_000_000): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max

const isShortStr = (s: unknown, max: number): s is string =>
  typeof s === 'string' && s.length > 0 && s.length <= max

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'check-claim') {
      const deviceId = url.searchParams.get('device_id')
      if (!deviceId || !/^[A-F0-9]{12}$/i.test(deviceId)) {
        return new Response(JSON.stringify({ error: 'device_id obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: device } = await supabase
        .from('devices')
        .select('id, is_claimed, user_id')
        .eq('device_id', deviceId.toUpperCase())
        .maybeSingle()

      if (!device || !device.is_claimed || !device.user_id) {
        return new Response(JSON.stringify({ claimed: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: secret } = await supabase
        .from('device_secrets')
        .select('device_token, token_retrieved_at')
        .eq('device_id', device.id)
        .maybeSingle()

      if (secret?.device_token && !secret.token_retrieved_at) {
        await supabase
          .from('device_secrets')
          .update({ token_retrieved_at: new Date().toISOString() })
          .eq('device_id', device.id)

        return new Response(
          JSON.stringify({ claimed: true, token: secret.device_token }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ claimed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const deviceToken = req.headers.get('X-Device-Token')
    const deviceId = req.headers.get('X-Device-ID')

    if (!deviceToken || !deviceId || !/^[A-F0-9]{12}$/i.test(deviceId)) {
      return new Response(JSON.stringify({ error: 'Headers X-Device-Token e X-Device-ID obrigatórios' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: device } = await supabase
      .from('devices')
      .select('id, user_id, is_claimed')
      .eq('device_id', deviceId.toUpperCase())
      .eq('is_claimed', true)
      .maybeSingle()

    if (!device) {
      return new Response(JSON.stringify({ error: 'Dispositivo não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: secret } = await supabase
      .from('device_secrets')
      .select('device_token')
      .eq('device_id', device.id)
      .maybeSingle()

    if (!secret || secret.device_token !== deviceToken) {
      return new Response(JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    switch (action) {
      case 'status': {
        const statusData = await req.json().catch(() => ({}))
        const storage = Number(statusData.storage_used_mb ?? 0)
        const totalBackups = Number(statusData.total_backups ?? 0)
        if (!isFiniteNumber(storage, 0, 10_000_000) || !isFiniteNumber(totalBackups, 0, 1_000_000)) {
          return new Response(JSON.stringify({ error: 'Campos numéricos inválidos' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        await supabase.from('devices').update({
          is_online: true, last_seen_at: new Date().toISOString()
        }).eq('id', device.id)
        const { error } = await supabase.from('device_status').insert({
          device_id: device.id,
          display_active: Boolean(statusData.display_active),
          wifi_connected: Boolean(statusData.wifi_connected),
          usb_host_active: Boolean(statusData.usb_host_active),
          transfer_active: Boolean(statusData.transfer_active),
          storage_used_mb: storage,
          total_backups: Math.floor(totalBackups),
        })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'log': {
        const logData = await req.json().catch(() => ({}))
        const level = typeof logData.log_level === 'string' ? logData.log_level : 'info'
        if (!VALID_LOG_LEVELS.includes(level)) {
          return new Response(JSON.stringify({ error: 'log_level inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        if (!isShortStr(logData.message, 4096)) {
          return new Response(JSON.stringify({ error: 'message inválida' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const { error } = await supabase.from('device_logs').insert({
          device_id: device.id,
          log_level: level,
          message: logData.message,
        })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'backup': {
        const backupData = await req.json().catch(() => ({}))
        if (!isShortStr(backupData.filename, 512)) {
          return new Response(JSON.stringify({ error: 'filename inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const fileSize = Number(backupData.file_size_mb ?? 0)
        if (!isFiniteNumber(fileSize, 0, 1_000_000)) {
          return new Response(JSON.stringify({ error: 'file_size_mb inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const backupType = typeof backupData.backup_type === 'string' ? backupData.backup_type : 'auto'
        if (!VALID_BACKUP_TYPES.includes(backupType)) {
          return new Response(JSON.stringify({ error: 'backup_type inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const status = typeof backupData.status === 'string' ? backupData.status : 'completed'
        if (!VALID_BACKUP_STATUS.includes(status)) {
          return new Response(JSON.stringify({ error: 'status inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const destination = backupData.destination
        if (destination !== undefined && destination !== null && !isShortStr(destination, 512)) {
          return new Response(JSON.stringify({ error: 'destination inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const { error } = await supabase.from('device_backups').insert({
          device_id: device.id,
          filename: backupData.filename,
          file_size_mb: fileSize,
          backup_type: backupType,
          status,
          destination: destination ?? null,
        })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      default:
        return new Response(JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (error) {
    console.error('Error in device-heartbeat:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
