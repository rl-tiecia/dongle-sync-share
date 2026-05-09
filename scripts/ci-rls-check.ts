#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * CI Check: validate RLS policies and GRANTs on the Supabase database
 * Usage:
 *   SUPABASE_DB_URL=postgres://... deno run --allow-net --allow-env --allow-read scripts/ci-rls-check.ts
 *
 * Exits with 1 if any violation is found.
 */
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL");
if (!DB_URL) {
  console.error("✖ SUPABASE_DB_URL not set");
  Deno.exit(2);
}

// Tables that must NEVER have permissive USING(true) for SELECT
const SENSITIVE_TABLES = [
  "profiles",
  "user_roles",
  "device_secrets",
  "delivery_agents",
  "network_destinations",
  "access_audit_log",
];

// Functions used in policies that MUST have GRANT EXECUTE TO authenticated
const REQUIRED_GRANT_FUNCTIONS = [
  "has_role",
  "can_access_device",
  "can_edit_device",
];

const client = new Client(DB_URL);
await client.connect();

let failures = 0;
const log = (ok: boolean, msg: string) => {
  console.log(`${ok ? "✔" : "✖"} ${msg}`);
  if (!ok) failures++;
};

// 1. Every public table has RLS enabled
{
  const { rows } = await client.queryObject<{ tablename: string; rowsecurity: boolean }>(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'`,
  );
  for (const r of rows) {
    log(r.rowsecurity === true, `RLS enabled on public.${r.tablename}`);
  }
}

// 2. Required functions have GRANT EXECUTE to authenticated
{
  for (const fn of REQUIRED_GRANT_FUNCTIONS) {
    const { rows } = await client.queryObject<{ has: boolean }>(
      `SELECT bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS has
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname='public' AND p.proname=$1`,
      [fn],
    );
    log(rows[0]?.has === true, `authenticated has EXECUTE on public.${fn}`);
  }
}

// 3. No sensitive table has SELECT policy with USING(true)
{
  const { rows } = await client.queryObject<{ tablename: string; policyname: string; qual: string | null; cmd: string }>(
    `SELECT tablename, policyname, qual, cmd FROM pg_policies WHERE schemaname='public'`,
  );
  for (const p of rows) {
    if (!SENSITIVE_TABLES.includes(p.tablename)) continue;
    if (p.cmd !== "SELECT" && p.cmd !== "ALL") continue;
    const open = p.qual && /^\s*true\s*$/i.test(p.qual);
    log(!open, `policy ${p.tablename}.${p.policyname} not USING(true)`);
  }
}

// 4. SECURITY DEFINER functions have explicit search_path
{
  const { rows } = await client.queryObject<{ proname: string; cfg: string[] | null }>(
    `SELECT p.proname, p.proconfig AS cfg
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prosecdef=true`,
  );
  for (const r of rows) {
    const hasSp = (r.cfg ?? []).some((c) => c.toLowerCase().startsWith("search_path"));
    log(hasSp, `SECURITY DEFINER public.${r.proname} sets search_path`);
  }
}

await client.end();

console.log(`\n${failures === 0 ? "✅" : "❌"} ${failures} failure(s)`);
Deno.exit(failures === 0 ? 0 : 1);
