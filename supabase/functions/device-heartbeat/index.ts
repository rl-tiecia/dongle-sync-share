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

    // Ação: verificar status de claim (antes de estar claimed)
    if (action === 'check-claim') {
      const deviceId = url.searchParams.get('device_id')
      
      if (!deviceId) {
        return new Response(
          JSON.stringify({ error: 'device_id obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('devices')
        .select('is_claimed, device_token, user_id')
        .eq('device_id', deviceId)
        .single()

      if (error || !data) {
        console.log(`Device not found for check-claim: ${deviceId}`)
        return new Response(
          JSON.stringify({ claimed: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const isClaimed = data.is_claimed && data.user_id !== null && data.user_id !== '00000000-0000-0000-0000-000000000000'

      return new Response(
        JSON.stringify({
          claimed: isClaimed,
          token: isClaimed ? data.device_token : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Demais ações requerem autenticação via device_token
    const deviceToken = req.headers.get('X-Device-Token')
    const deviceId = req.headers.get('X-Device-ID')

    if (!deviceToken || !deviceId) {
      return new Response(
        JSON.stringify({ error: 'Headers X-Device-Token e X-Device-ID obrigatórios' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar token
    const { data: device, error: authError } = await supabase
      .from('devices')
      .select('id, user_id, is_claimed')
      .eq('device_id', deviceId)
      .eq('device_token', deviceToken)
      .eq('is_claimed', true)
      .single()

    if (authError || !device) {
      console.error('Auth failed:', deviceId, authError)
      return new Response(
        JSON.stringify({ error: 'Token inválido ou dispositivo não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Processar ações autenticadas
    switch (action) {
      case 'status': {
        const statusData = await req.json()
        
        // Atualizar last_seen
        await supabase
          .from('devices')
          .update({ 
            is_online: true,
            last_seen_at: new Date().toISOString()
          })
          .eq('id', device.id)

        // Inserir status
        const { error: statusError } = await supabase
          .from('device_status')
          .insert({
            device_id: device.id,
            display_active: statusData.display_active ?? false,
            wifi_connected: statusData.wifi_connected ?? false,
            usb_host_active: statusData.usb_host_active ?? false,
            transfer_active: statusData.transfer_active ?? false,
            storage_used_mb: statusData.storage_used_mb ?? 0,
            total_backups: statusData.total_backups ?? 0
          })

        if (statusError) {
          console.error('Status error:', statusError)
          throw statusError
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'log': {
        const logData = await req.json()
        
        const { error: logError } = await supabase
          .from('device_logs')
          .insert({
            device_id: device.id,
            log_level: logData.log_level || 'info',
            message: logData.message
          })

        if (logError) {
          console.error('Log error:', logError)
          throw logError
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'backup': {
        const backupData = await req.json()
        
        const { error: backupError } = await supabase
          .from('device_backups')
          .insert({
            device_id: device.id,
            filename: backupData.filename,
            file_size_mb: backupData.file_size_mb,
            backup_type: backupData.backup_type || 'auto',
            status: backupData.status || 'completed',
            destination: backupData.destination
          })

        if (backupError) {
          console.error('Backup error:', backupError)
          throw backupError
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida. Use: status, log, backup, check-claim' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error in device-heartbeat:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
