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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('Unauthorized access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se usuário é admin
    const { data: isAdmin } = await supabaseAdmin.rpc('is_admin', { _user_id: user.id });
    if (!isAdmin) {
      console.error('Non-admin user tried to update role:', user.id);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { target_user_id, new_role } = await req.json();

    const VALID_ROLES = ['admin', 'user'];
    if (typeof target_user_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(target_user_id)) {
      return new Response(JSON.stringify({ error: 'target_user_id inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!VALID_ROLES.includes(new_role)) {
      return new Response(JSON.stringify({ error: 'Role inválida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Admin updating user role:', { target_user_id, new_role });

    // Deletar role antiga
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', target_user_id);

    // Inserir nova role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: target_user_id,
        role: new_role,
        assigned_by: user.id,
      });

    if (roleError) {
      console.error('Error updating role:', roleError);
      throw roleError;
    }

    console.log('Role updated successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Role atualizada com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-user-role:', error);
    return new Response(JSON.stringify({ error: 'Erro ao atualizar role' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
