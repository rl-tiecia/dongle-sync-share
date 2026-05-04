import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { mac_address, firmware_version } = await req.json()

    if (!mac_address || !/^[A-F0-9]{12}$/i.test(mac_address)) {
      return new Response(
        JSON.stringify({ error: 'MAC address inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const mac = mac_address.toUpperCase()

    const { data: existing } = await supabase
      .from('devices')
      .select('id, is_claimed')
      .eq('device_id', mac)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({
          device_uuid: existing.id,
          already_registered: true,
          is_claimed: existing.is_claimed
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabase
      .from('devices')
      .insert({
        device_id: mac,
        mac_address: mac,
        device_name: `T-Dongle-${mac.substring(0, 6)}`,
        firmware_version: firmware_version || '1.0.0',
        is_claimed: false,
        is_online: true,
        user_id: null,
      })
      .select('id')
      .single()

    if (error) throw error

    // Store claim_code in secure secrets table
    await supabase.from('device_secrets').insert({
      device_id: data.id,
      claim_code: mac,
    })

    return new Response(
      JSON.stringify({ device_uuid: data.id, message: 'Dispositivo registrado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in device-register:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
