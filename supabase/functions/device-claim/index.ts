import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { claim_code } = await req.json()
    if (!claim_code || !/^[A-F0-9]{12}$/i.test(claim_code)) {
      return new Response(JSON.stringify({ error: 'Código de vinculação inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const code = claim_code.toUpperCase()

    // Look up the device via device_secrets.claim_code
    const { data: secret, error: secretErr } = await supabaseAdmin
      .from('device_secrets')
      .select('device_id')
      .eq('claim_code', code)
      .maybeSingle()

    if (secretErr || !secret) {
      return new Response(JSON.stringify({ error: 'Código inválido ou já utilizado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: device } = await supabaseAdmin
      .from('devices')
      .select('id, is_claimed, user_id')
      .eq('id', secret.device_id)
      .single()

    if (device?.is_claimed && device.user_id && device.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Dispositivo já vinculado a outro usuário' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Generate device token
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const deviceToken = btoa(String.fromCharCode(...tokenBytes))

    const { error: updErr } = await supabaseAdmin
      .from('devices')
      .update({
        user_id: user.id,
        is_claimed: true,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', secret.device_id)
    if (updErr) throw updErr

    // Reset retrieval state — device must pick up token once via check-claim
    await supabaseAdmin
      .from('device_secrets')
      .update({ device_token: deviceToken, token_retrieved_at: null })
      .eq('device_id', secret.device_id)

    return new Response(
      JSON.stringify({ success: true, device_id: secret.device_id, message: 'Dispositivo vinculado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in device-claim:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
