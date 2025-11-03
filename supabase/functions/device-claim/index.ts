import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Obter JWT do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { claim_code } = await req.json()

    // Validar claim_code
    if (!claim_code || !/^[A-F0-9]{12}$/i.test(claim_code)) {
      return new Response(
        JSON.stringify({ error: 'Código de vinculação inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Usar service role para operações no banco
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar dispositivo
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('devices')
      .select('id, is_claimed, user_id')
      .eq('claim_code', claim_code.toUpperCase())
      .single()

    if (deviceError || !device) {
      console.error('Device not found:', claim_code, deviceError)
      return new Response(
        JSON.stringify({ error: 'Código inválido ou já utilizado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se já está claimed por outro usuário
    if (device.is_claimed && device.user_id !== user.id && device.user_id !== '00000000-0000-0000-0000-000000000000') {
      return new Response(
        JSON.stringify({ error: 'Dispositivo já vinculado a outro usuário' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar token seguro (32 bytes = 256 bits)
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const deviceToken = btoa(String.fromCharCode(...tokenBytes))

    // Vincular dispositivo ao usuário
    const { error: updateError } = await supabaseAdmin
      .from('devices')
      .update({
        user_id: user.id,
        is_claimed: true,
        claimed_at: new Date().toISOString(),
        device_token: deviceToken
      })
      .eq('id', device.id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw updateError
    }

    console.log(`✓ Device claimed: ${claim_code} by user ${user.id}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        device_id: device.id,
        message: 'Dispositivo vinculado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in device-claim:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
