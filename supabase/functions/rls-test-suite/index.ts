import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TestCase = {
  name: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  error?: string;
};

function eq(name: string, expected: unknown, actual: unknown, error?: string): TestCase {
  return { name, expected, actual, passed: JSON.stringify(expected) === JSON.stringify(actual), error };
}

async function userClient(url: string, anonKey: string, email: string, password: string): Promise<{ client: SupabaseClient; userId: string }> {
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`signIn ${email}: ${error?.message}`);
  return { client: c, userId: data.user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // AuthZ: caller must be admin
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const stamp = Date.now();
  const created: { type: "user" | "device" | "permission"; id: string }[] = [];
  const cases: TestCase[] = [];

  const mkUser = async (label: string, role?: "admin" | "user") => {
    const email = `rlstest+${label}_${stamp}@lovable.test`;
    const password = `Test_${stamp}_${Math.random().toString(36).slice(2, 10)}!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);
    created.push({ type: "user", id: data.user.id });
    if (role) {
      // Replace default 'user' role inserted by trigger
      await admin.from("user_roles").delete().eq("user_id", data.user.id);
      await admin.from("user_roles").insert({ user_id: data.user.id, role });
    }
    return { id: data.user.id, email, password };
  };

  try {
    const adminU = await mkUser("admin", "admin");
    const ownerU = await mkUser("owner");
    const editorU = await mkUser("editor");
    const viewerU = await mkUser("viewer");
    const strangerU = await mkUser("stranger");

    // Owner creates a device (via service role to keep test isolated)
    const { data: dev, error: devErr } = await admin
      .from("devices")
      .insert({
        user_id: ownerU.id,
        device_name: `rls-test-${stamp}`,
        device_id: `RLSTEST-${stamp}`,
        is_claimed: true,
      })
      .select()
      .single();
    if (devErr || !dev) throw new Error(`device insert: ${devErr?.message}`);
    created.push({ type: "device", id: dev.id });

    // Permissions
    await admin.from("device_permissions").insert([
      { device_id: dev.id, user_id: editorU.id, permission_level: "editor", granted_by: ownerU.id },
      { device_id: dev.id, user_id: viewerU.id, permission_level: "viewer", granted_by: ownerU.id },
    ]);

    // ========= has_role =========
    const owner = await userClient(url, anonKey, ownerU.email, ownerU.password);
    const editor = await userClient(url, anonKey, editorU.email, editorU.password);
    const viewer = await userClient(url, anonKey, viewerU.email, viewerU.password);
    const stranger = await userClient(url, anonKey, strangerU.email, strangerU.password);
    const adm = await userClient(url, anonKey, adminU.email, adminU.password);

    {
      const { data } = await adm.client.rpc("has_role", { _user_id: adm.userId, _role: "admin" });
      cases.push(eq("admin has_role(admin) = true", true, data));
    }
    {
      const { data } = await owner.client.rpc("has_role", { _user_id: owner.userId, _role: "admin" });
      cases.push(eq("owner has_role(admin) = false", false, data));
    }

    // ========= can_access_device =========
    for (const [label, u, expected] of [
      ["owner", owner, true],
      ["editor", editor, true],
      ["viewer", viewer, true],
      ["stranger", stranger, false],
      ["admin", adm, true],
    ] as const) {
      const { data } = await u.client.rpc("can_access_device", { _user_id: u.userId, _device_id: dev.id });
      cases.push(eq(`can_access_device(${label}) = ${expected}`, expected, data));
    }

    // ========= can_edit_device =========
    for (const [label, u, expected] of [
      ["owner", owner, true],
      ["editor", editor, true],
      ["viewer", viewer, false],
      ["stranger", stranger, false],
      ["admin", adm, true],
    ] as const) {
      const { data } = await u.client.rpc("can_edit_device", { _user_id: u.userId, _device_id: dev.id });
      cases.push(eq(`can_edit_device(${label}) = ${expected}`, expected, data));
    }

    // ========= devices SELECT visibility =========
    for (const [label, u, expected] of [
      ["owner sees device", owner, true],
      ["editor sees device", editor, true],
      ["viewer sees device", viewer, true],
      ["stranger does NOT see device", stranger, false],
    ] as const) {
      const { data } = await u.client.from("devices").select("id").eq("id", dev.id).maybeSingle();
      cases.push(eq(label, expected, !!data));
    }

    // ========= devices UPDATE blocked for viewer =========
    {
      const { error } = await viewer.client.from("devices").update({ device_name: "should-fail" }).eq("id", dev.id);
      // Either RLS blocks (error) or update affects 0 rows; we re-read to confirm name unchanged
      const { data: after } = await admin.from("devices").select("device_name").eq("id", dev.id).single();
      cases.push(eq("viewer cannot rename device", `rls-test-${stamp}`, after?.device_name, error?.message));
    }
    {
      const { error } = await editor.client.from("devices").update({ device_name: `rls-test-${stamp}-edited` }).eq("id", dev.id);
      const { data: after } = await admin.from("devices").select("device_name").eq("id", dev.id).single();
      cases.push(eq("editor can rename device", `rls-test-${stamp}-edited`, after?.device_name, error?.message));
    }

    // ========= audited variants log a row =========
    {
      const before = await admin.from("access_audit_log").select("id", { count: "exact", head: true }).eq("user_id", stranger.userId);
      await stranger.client.rpc("can_access_device_audited", { _user_id: stranger.userId, _device_id: dev.id });
      const after = await admin.from("access_audit_log").select("id", { count: "exact", head: true }).eq("user_id", stranger.userId);
      cases.push(eq("audited call writes audit row", true, (after.count ?? 0) > (before.count ?? 0)));
    }
  } catch (e) {
    cases.push({ name: "fatal setup error", expected: "no throw", actual: String(e), passed: false, error: String(e) });
  } finally {
    // Cleanup
    for (const r of created.reverse()) {
      try {
        if (r.type === "user") await admin.auth.admin.deleteUser(r.id);
        if (r.type === "device") await admin.from("devices").delete().eq("id", r.id);
      } catch (_) { /* swallow */ }
    }
  }

  const passed = cases.filter((c) => c.passed).length;
  const failed = cases.length - passed;
  return new Response(JSON.stringify({ passed, failed, total: cases.length, cases }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
