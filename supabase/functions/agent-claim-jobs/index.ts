// Edge function: agent-claim-jobs
// Local agent calls this to fetch the next batch of backups pending delivery
// to a network destination (SMB/NFS). Agent authenticates with X-Agent-Token.
// Returns up to N jobs whose delivery_next_attempt_at is due, including the
// matching network_destination details and a short-lived signed URL to the file.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

const MAX_JOBS = 10
const SIGNED_URL_TTL_S = 600

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const agentToken = req.headers.get('X-Agent-Token')
    if (!agentToken || agentToken.length < 20 || agentToken.length > 200) {
      return json({ error: 'Missing agent token' }, 401)
    }

    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('id, user_id, enabled')
      .eq('agent_token', agentToken)
      .maybeSingle()
    if (!agent || !agent.enabled) return json({ error: 'Invalid agent' }, 401)

    await supabase
      .from('delivery_agents')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', agent.id)

    // Devices owned by the agent's user (and shared editable devices)
    const { data: ownedDevices } = await supabase
      .from('devices')
      .select('id')
      .eq('user_id', agent.user_id)
    const deviceIds = (ownedDevices ?? []).map((d) => d.id)
    if (deviceIds.length === 0) return json({ jobs: [] })

    const nowIso = new Date().toISOString()
    const { data: rows } = await supabase
      .from('device_backups')
      .select('id, device_id, filename, file_size_mb, storage_path, md5_hash, network_destination_id, delivery_attempts')
      .in('device_id', deviceIds)
      .in('delivery_status', ['pending', 'retry'])
      .or(`delivery_next_attempt_at.is.null,delivery_next_attempt_at.lte.${nowIso}`)
      .order('delivery_next_attempt_at', { ascending: true })
      .limit(MAX_JOBS)

    if (!rows || rows.length === 0) return json({ jobs: [] })

    // Mark in-flight to avoid duplicate work + log per-row attempt
    for (const r of rows) {
      const nextAttempt = (r.delivery_attempts ?? 0) + 1
      await supabase.from('device_backups').update({
        delivery_status: 'in_flight',
        delivery_last_attempt_at: nowIso,
        delivery_attempts: nextAttempt,
      }).eq('id', r.id)
      await supabase.from('delivery_attempts').insert({
        backup_id: r.id,
        attempt_number: nextAttempt,
        status: 'in_flight',
        agent_id: agent.id,
      })
    }

    // Build response per job
    const jobs = []
    for (const r of rows) {
      let destination: any = null
      if (r.network_destination_id) {
        const { data: dest } = await supabase
          .from('network_destinations')
          .select('id, name, protocol, host, port, share, remote_path, username, password, domain')
          .eq('id', r.network_destination_id)
          .maybeSingle()
        destination = dest
      }
      if (!destination) {
        // pick default destination for the device's owner
        const { data: dev } = await supabase
          .from('devices').select('user_id').eq('id', r.device_id).maybeSingle()
        if (dev?.user_id) {
          const { data: dest } = await supabase
            .from('network_destinations')
            .select('id, name, protocol, host, port, share, remote_path, username, password, domain')
            .eq('user_id', dev.user_id)
            .eq('enabled', true)
            .order('is_default', { ascending: false })
            .limit(1).maybeSingle()
          destination = dest
        }
      }
      if (!destination || !r.storage_path) continue

      const { data: signed } = await supabase.storage
        .from('device-backups')
        .createSignedUrl(r.storage_path, SIGNED_URL_TTL_S)

      if (!signed) continue

      jobs.push({
        backup_id: r.id,
        filename: r.filename,
        size_mb: r.file_size_mb,
        md5: r.md5_hash,
        download_url: signed.signedUrl,
        destination,
        attempt: (r.delivery_attempts ?? 0) + 1,
      })
    }

    return json({ jobs })
  } catch (e) {
    console.error('agent-claim-jobs error', e)
    return json({ error: 'Internal error' }, 500)
  }
})

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
