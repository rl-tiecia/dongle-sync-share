// Edge function: agent-report-delivery
// Webhook the local agent calls after attempting to push a backup file to the
// configured SMB/NFS share. On failure schedules an exponential-backoff retry
// (capped at 6h) and stops after MAX_ATTEMPTS marking the delivery as failed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

const MAX_ATTEMPTS = 8
const BASE_DELAY_MS = 30_000 // 30s
const MAX_DELAY_MS = 6 * 60 * 60 * 1000 // 6h

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const agentToken = req.headers.get('X-Agent-Token')
    if (!agentToken) return json({ error: 'Missing agent token' }, 401)

    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('id, user_id, enabled')
      .eq('agent_token', agentToken)
      .maybeSingle()
    if (!agent || !agent.enabled) return json({ error: 'Invalid agent' }, 401)

    const body = await req.json().catch(() => ({}))
    const backupId = typeof body.backup_id === 'string' ? body.backup_id : null
    if (!backupId) return json({ error: 'backup_id required' }, 400)
    const success = body.success === true
    const errorMsg = typeof body.error === 'string' ? body.error.slice(0, 1024) : null
    const errorCode = typeof body.error_code === 'string' ? body.error_code.slice(0, 64) : null
    const deliveredPath = typeof body.delivered_path === 'string' ? body.delivered_path.slice(0, 1024) : null

    // Confirm backup belongs to a device owned by the agent's user
    const { data: backup } = await supabase
      .from('device_backups')
      .select('id, device_id, delivery_attempts, delivery_status')
      .eq('id', backupId)
      .maybeSingle()
    if (!backup) return json({ error: 'Backup not found' }, 404)
    if (backup.delivery_status === 'cancelled') {
      return json({ ok: true, cancelled: true })
    }
    const { data: dev } = await supabase
      .from('devices').select('user_id').eq('id', backup.device_id).maybeSingle()
    if (!dev || dev.user_id !== agent.user_id) return json({ error: 'Forbidden' }, 403)

    const nowIso = new Date().toISOString()

    const attempts = backup.delivery_attempts ?? 0

    if (success) {
      await supabase.from('device_backups').update({
        delivery_status: 'delivered',
        delivered_at: nowIso,
        delivered_path: deliveredPath,
        delivery_error: null,
        delivery_error_code: null,
        delivery_next_attempt_at: null,
      }).eq('id', backup.id)
      await supabase.from('delivery_attempts').insert({
        backup_id: backup.id, attempt_number: attempts, status: 'success',
        delivered_path: deliveredPath, agent_id: agent.id,
      })
      return json({ ok: true })
    }

    if (attempts >= MAX_ATTEMPTS) {
      await supabase.from('device_backups').update({
        delivery_status: 'failed',
        delivery_error: errorMsg,
        delivery_error_code: errorCode,
        delivery_next_attempt_at: null,
      }).eq('id', backup.id)
      await supabase.from('delivery_attempts').insert({
        backup_id: backup.id, attempt_number: attempts, status: 'error',
        error_code: errorCode, error_message: errorMsg, agent_id: agent.id,
      })
      return json({ ok: true, retried: false })
    }

    const delayMs = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS)
    const next = new Date(Date.now() + delayMs).toISOString()
    await supabase.from('device_backups').update({
      delivery_status: 'retry',
      delivery_error: errorMsg,
      delivery_error_code: errorCode,
      delivery_next_attempt_at: next,
    }).eq('id', backup.id)
    await supabase.from('delivery_attempts').insert({
      backup_id: backup.id, attempt_number: attempts, status: 'error',
      error_code: errorCode, error_message: errorMsg, next_attempt_at: next, agent_id: agent.id,
    })

    return json({ ok: true, retried: true, next_attempt_at: next })
  } catch (e) {
    console.error('agent-report-delivery error', e)
    return json({ error: 'Internal error' }, 500)
  }
})

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
