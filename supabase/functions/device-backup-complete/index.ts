// Edge function: device-backup-complete
// Called by the ESP32 after the upload finishes (or to report failure).
// Verifies MD5 against the object stored in Supabase Storage and updates the
// `device_backups` row with final status, duration and integrity flag.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

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
    const backupId = typeof body.backup_id === 'string' ? body.backup_id : null
    if (!backupId) return json({ error: 'backup_id required' }, 400)

    const { data: backup } = await supabase
      .from('device_backups')
      .select('id, device_id, storage_path, md5_hash, upload_started_at, file_size_mb')
      .eq('id', backupId)
      .eq('device_id', device.id)
      .maybeSingle()
    if (!backup) return json({ error: 'Backup not found' }, 404)

    const success = body.success !== false
    if (!success) {
      const errMsg = typeof body.error === 'string' ? body.error.slice(0, 1024) : 'Upload failed'
      await supabase.from('device_backups').update({
        status: 'failed',
        error_message: errMsg,
        upload_completed_at: new Date().toISOString(),
      }).eq('id', backup.id)
      return json({ success: true })
    }

    // Verify MD5: download object and recompute
    let integrityOk = false
    let serverMd5: string | null = null
    if (backup.storage_path && backup.md5_hash) {
      const { data: file, error: dlErr } = await supabase.storage
        .from('device-backups')
        .download(backup.storage_path)
      if (!dlErr && file) {
        const buf = new Uint8Array(await file.arrayBuffer())
        serverMd5 = await md5Hex(buf)
        integrityOk = serverMd5 === backup.md5_hash.toLowerCase()
      }
    }

    const completedAt = new Date()
    const startedAt = backup.upload_started_at ? new Date(backup.upload_started_at) : null
    const durationMs = startedAt ? completedAt.getTime() - startedAt.getTime() : null

    await supabase.from('device_backups').update({
      status: integrityOk ? 'completed' : (backup.md5_hash ? 'failed' : 'completed'),
      integrity_verified: integrityOk,
      upload_completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
      progress: 100,
      error_message: integrityOk || !backup.md5_hash
        ? null
        : `MD5 mismatch (server=${serverMd5})`,
    }).eq('id', backup.id)

    return json({ success: true, integrity_verified: integrityOk })
  } catch (e) {
    console.error('device-backup-complete error', e)
    return json({ error: 'Internal error' }, 500)
  }
})

async function md5Hex(data: Uint8Array): Promise<string> {
  // Deno's Web Crypto doesn't support MD5; use a tiny implementation.
  // Source: ported from RFC 1321 reference (compact form).
  function toHex(n: number) {
    let s = ''
    for (let j = 0; j < 4; j++) s += ((n >> (j * 8 + 4)) & 0x0f).toString(16) + ((n >> (j * 8)) & 0x0f).toString(16)
    return s
  }
  const r = new Int32Array([
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ])
  const k = new Int32Array(64)
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0

  const len = data.length
  const withOne = new Uint8Array(((len + 9 + 63) >> 6) << 6)
  withOne.set(data)
  withOne[len] = 0x80
  const bitLen = BigInt(len) * 8n
  const dv = new DataView(withOne.buffer)
  dv.setUint32(withOne.length - 8, Number(bitLen & 0xffffffffn), true)
  dv.setUint32(withOne.length - 4, Number((bitLen >> 32n) & 0xffffffffn), true)

  let a0 = 0x67452301 | 0, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476 | 0
  for (let off = 0; off < withOne.length; off += 64) {
    const M = new Int32Array(16)
    for (let i = 0; i < 16; i++) M[i] = dv.getInt32(off + i * 4, true)
    let A = a0, B = b0, C = c0, D = d0
    for (let i = 0; i < 64; i++) {
      let F = 0, g = 0
      if (i < 16) { F = (B & C) | (~B & D); g = i }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16 }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16 }
      else { F = C ^ (B | ~D); g = (7 * i) % 16 }
      F = (F + A + k[i] + M[g]) | 0
      A = D; D = C; C = B
      const s = r[i]
      B = (B + ((F << s) | (F >>> (32 - s)))) | 0
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0
  }
  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0)
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
