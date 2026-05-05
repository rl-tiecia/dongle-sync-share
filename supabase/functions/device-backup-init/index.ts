// Edge function: device-backup-init
// Called by ESP32 device when it detects a finished backup file.
// Authenticates the device, creates a `device_backups` row in `uploading` status,
// and returns a signed upload URL to Supabase Storage (`device-backups` bucket).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

const isShortStr = (s: unknown, max: number): s is string =>
  typeof s === 'string' && s.length > 0 && s.length <= max

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const deviceToken = req.headers.get('X-Device-Token')
    const deviceId = req.headers.get('X-Device-ID')
    if (!deviceToken || !deviceId || !/^[A-F0-9]{12}$/i.test(deviceId)) {
      return json({ error: 'Auth headers missing' }, 401)
    }

    const { data: device } = await supabase
      .from('devices')
      .select('id, is_claimed')
      .eq('device_id', deviceId.toUpperCase())
      .eq('is_claimed', true)
      .maybeSingle()
    if (!device) return json({ error: 'Device not authorized' }, 401)

    const { data: secret } = await supabase
      .from('device_secrets')
      .select('device_token')
      .eq('device_id', device.id)
      .maybeSingle()
    if (!secret || secret.device_token !== deviceToken) {
      return json({ error: 'Invalid token' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    if (!isShortStr(body.filename, 512)) return json({ error: 'filename inválido' }, 400)
    const fileSizeMb = Number(body.file_size_mb ?? 0)
    if (!Number.isFinite(fileSizeMb) || fileSizeMb < 0 || fileSizeMb > 10240) {
      return json({ error: 'file_size_mb inválido' }, 400)
    }
    const md5 = typeof body.md5_hash === 'string' && /^[a-f0-9]{32}$/i.test(body.md5_hash)
      ? body.md5_hash.toLowerCase()
      : null
    const contentType = isShortStr(body.content_type, 128) ? body.content_type : 'application/octet-stream'

    // Sanitize filename to avoid path traversal
    const safeName = body.filename.replace(/[\/\\]/g, '_').slice(0, 200)

    const { data: backup, error: insertErr } = await supabase
      .from('device_backups')
      .insert({
        device_id: device.id,
        filename: safeName,
        file_size_mb: fileSizeMb,
        backup_type: 'auto',
        status: 'uploading',
        md5_hash: md5,
        content_type: contentType,
        upload_started_at: new Date().toISOString(),
        progress: 0,
      })
      .select('id')
      .single()

    if (insertErr || !backup) {
      console.error('insert backup err', insertErr)
      return json({ error: 'Failed to create backup record' }, 500)
    }

    const storagePath = `${device.id}/${backup.id}/${safeName}`

    const { data: signed, error: signErr } = await supabase.storage
      .from('device-backups')
      .createSignedUploadUrl(storagePath)
    if (signErr || !signed) {
      console.error('sign err', signErr)
      return json({ error: 'Failed to create upload url' }, 500)
    }

    await supabase
      .from('device_backups')
      .update({ storage_path: storagePath })
      .eq('id', backup.id)

    return json({
      backup_id: backup.id,
      storage_path: storagePath,
      upload_url: signed.signedUrl,
      token: signed.token,
    })
  } catch (e) {
    console.error('device-backup-init error', e)
    return json({ error: 'Internal error' }, 500)
  }
})

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
