import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const email = 'admin@monitor.local';
    const password = 'Admin@123456';
    const full_name = 'Administrador';

    // Check if user already exists
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    let userId = list?.users?.find((u) => u.email === email)?.id;

    if (!userId) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    } else {
      // Reset password to known value
      await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    }

    // Ensure profile exists
    await supabaseAdmin.from('profiles').upsert({ id: userId, email, full_name });

    // Ensure admin role
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from('user_roles').insert({ user_id: userId, role: 'admin' });
    }

    return new Response(
      JSON.stringify({ success: true, email, password, user_id: userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('seed-admin error:', error);
    return new Response(JSON.stringify({ error: 'Erro ao criar admin' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
