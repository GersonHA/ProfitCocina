/**
 * Edge Function `admin-create-user`
 *
 * Permite que el ADMIN de un grupo cree la cuenta de un miembro desde la app:
 * valida que quien llama sea admin del grupo, crea el usuario con la
 * service_role (email confirmado + contraseña), le fija nick y recurso que
 * produce, y lo añade al grupo. Devuelve el email creado.
 *
 * La service_role vive SOLO aquí (nunca en el navegador). El cliente solo manda
 * su sesión; la función comprueba el rol antes de hacer nada.
 *
 * Entrada (POST): { group_id, email, password, nick?, produce?, role? }
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

    const { group_id, email, password, nick, produce, role } = await req.json().catch(() => ({}));
    if (!group_id || !email || !password) {
      return json({ error: 'Faltan datos: group_id, email y password son obligatorios.' }, 400);
    }
    if (String(password).length < 6) {
      return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400);
    }

    // Quién llama (su sesión).
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: auth, error: authErr } = await userClient.auth.getUser();
    if (authErr || !auth.user) return json({ error: 'No autenticado.' }, 401);
    const callerId = auth.user.id;

    const admin = createClient(url, service);

    // El llamante debe ser admin del grupo.
    const { data: membership } = await admin
      .from('group_members')
      .select('role')
      .eq('group_id', group_id)
      .eq('user_id', callerId)
      .maybeSingle();
    if (!membership || membership.role !== 'admin') {
      return json({ error: 'Solo el admin del grupo puede crear cuentas.' }, 403);
    }

    // Crear el usuario (email ya confirmado).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nick, produce },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'No se pudo crear el usuario.' }, 400);
    }
    const newId = created.user.id;

    // Perfil: nick + recurso que produce (el trigger ya creó la fila; la actualizamos).
    await admin
      .from('profiles')
      .upsert({ user_id: newId, nick: nick ?? null, especializaciones: produce ? { produce } : {} });

    // Añadir al grupo.
    const { error: memErr } = await admin.from('group_members').insert({
      group_id,
      user_id: newId,
      role: role === 'admin' ? 'admin' : 'member',
    });
    if (memErr) return json({ error: memErr.message }, 400);

    return json({ ok: true, email, user_id: newId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
