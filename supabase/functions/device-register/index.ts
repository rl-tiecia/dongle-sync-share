import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { mac_address, firmware_version } = await req.json()

    // Validação básica
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

    // Verificar se já existe (idempotência)
    const { data: existing } = await supabase
      .from('devices')
      .select('id, is_claimed')
      .eq('device_id', mac_address)
      .single()

    if (existing) {
      console.log(`Device already registered: ${mac_address}`)
      return new Response(
        JSON.stringify({ 
          device_uuid: existing.id,
          already_registered: true,
          is_claimed: existing.is_claimed
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Registrar novo dispositivo
    const { data, error } = await supabase
      .from('devices')
      .insert({
        device_id: mac_address,
        mac_address: mac_address,
        device_name: `T-Dongle-${mac_address.substring(0, 6)}`,
        firmware_version: firmware_version || '1.0.0',
        claim_code: mac_address,
        is_claimed: false,
        is_online: true,
        user_id: '00000000-0000-0000-0000-000000000000' // UUID temporário
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error registering device:', error)
      throw error
    }

    console.log(`✓ Device registered: ${mac_address} -> ${data.id}`)

    return new Response(
      JSON.stringify({ 
        device_uuid: data.id,
        message: 'Dispositivo registrado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in device-register:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
