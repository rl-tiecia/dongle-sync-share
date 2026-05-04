import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

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

    // ─────────────────────────────────────────────────────────────
    // check-claim: device polls to learn whether it has been claimed.
    // Token is delivered ONCE (single-use pickup) to mitigate token
    // leakage by MAC enumeration.
    // ─────────────────────────────────────────────────────────────
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

      // Atomic single-use token retrieval
      const { data: secret } = await supabase
        .from('device_secrets')
        .select('device_token, token_retrieved_at')
        .eq('device_id', device.id)
        .maybeSingle()

      // Only deliver the token if it has never been retrieved yet
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

      // Token already picked up previously — do not leak
      return new Response(JSON.stringify({ claimed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ─────────────────────────────────────────────────────────────
    // Authenticated device actions: status / log / backup
    // ─────────────────────────────────────────────────────────────
    const deviceToken = req.headers.get('X-Device-Token')
    const deviceId = req.headers.get('X-Device-ID')

    if (!deviceToken || !deviceId) {
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
        const statusData = await req.json()
        await supabase.from('devices').update({
          is_online: true, last_seen_at: new Date().toISOString()
        }).eq('id', device.id)
        const { error } = await supabase.from('device_status').insert({
          device_id: device.id,
          display_active: statusData.display_active ?? false,
          wifi_connected: statusData.wifi_connected ?? false,
          usb_host_active: statusData.usb_host_active ?? false,
          transfer_active: statusData.transfer_active ?? false,
          storage_used_mb: statusData.storage_used_mb ?? 0,
          total_backups: statusData.total_backups ?? 0,
        })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'log': {
        const logData = await req.json()
        const { error } = await supabase.from('device_logs').insert({
          device_id: device.id,
          log_level: logData.log_level || 'info',
          message: logData.message,
        })
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'backup': {
        const backupData = await req.json()
        const { error } = await supabase.from('device_backups').insert({
          device_id: device.id,
          filename: backupData.filename,
          file_size_mb: backupData.file_size_mb,
          backup_type: backupData.backup_type || 'auto',
          status: backupData.status || 'completed',
          destination: backupData.destination,
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
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
