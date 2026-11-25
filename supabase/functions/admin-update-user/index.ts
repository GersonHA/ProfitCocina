/**
 * Edge Function `admin-update-user`
 *
 * El ADMIN de un grupo edita o quita a un miembro: cambiar nick / recurso,
 * cambiar rol, resetear contraseña, o quitarlo del grupo. Valida que quien
 * llama sea admin del grupo y que el objetivo sea miembro. La service_role
 * vive solo aquí.
 *
 * Entrada (POST): { group_id, target_user_id, nick?, produce?, role?, password?, remove? }
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const { group_id, target_user_id, nick, produce, role, password, remove } = await req.json().catch(() => ({}));
    if (!group_id || !target_user_id) return json({ error: 'Faltan datos: group_id y target_user_id.' }, 400);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: auth, error: authErr } = await userClient.auth.getUser();
    if (authErr || !auth.user) return json({ error: 'No autenticado.' }, 401);
    const callerId = auth.user.id;

    const admin = createClient(url, service);

    // El llamante debe ser admin del grupo.
    const { data: caller } = await admin
      .from('group_members')
      .select('role')
      .eq('group_id', group_id)
      .eq('user_id', callerId)
      .maybeSingle();
    if (!caller || caller.role !== 'admin') return json({ error: 'Solo el admin del grupo puede editar miembros.' }, 403);

    // El objetivo debe ser miembro del grupo.
    const { data: target } = await admin
      .from('group_members')
      .select('role')
      .eq('group_id', group_id)
      .eq('user_id', target_user_id)
      .maybeSingle();
    if (!target) return json({ error: 'Ese usuario no es miembro del grupo.' }, 404);

    // No te quites ni te degrades a ti mismo desde aquí (evita quedar sin admin).
    if (target_user_id === callerId && (remove || role === 'member')) {
      return json({ error: 'No puedes quitarte ni degradarte a ti mismo.' }, 400);
    }

    if (remove) {
      const { error } = await admin.from('group_members').delete().eq('group_id', group_id).eq('user_id', target_user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, removed: true });
    }

    if (nick !== undefined || produce !== undefined) {
      const patch: Record<string, unknown> = {};
      if (nick !== undefined) patch.nick = nick;
      if (produce !== undefined) patch.especializaciones = produce ? { produce } : {};
      const { error } = await admin.from('profiles').update(patch).eq('user_id', target_user_id);
      if (error) return json({ error: error.message }, 400);
    }

    if (role === 'admin' || role === 'member') {
      const { error } = await admin
        .from('group_members')
        .update({ role })
        .eq('group_id', group_id)
        .eq('user_id', target_user_id);
      if (error) return json({ error: error.message }, 400);
    }

    if (password) {
      if (String(password).length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(target_user_id, { password });
      if (error) return json({ error: error.message }, 400);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
