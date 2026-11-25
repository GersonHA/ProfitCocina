/**
 * Llama a la Edge Function `admin-create-user` para que el admin del grupo cree
 * la cuenta de un miembro. La service_role vive en la función, no aquí.
 */
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { supabase } from '$lib/supabase';

export interface NewMember {
  groupId: string;
  email: string;
  password: string;
  nick: string;
  produce: string;
  role?: 'member' | 'admin';
}

export async function createMember(input: NewMember): Promise<{ ok: boolean; email: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay sesión activa.');

  const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/admin-create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      group_id: input.groupId,
      email: input.email,
      password: input.password,
      nick: input.nick,
      produce: input.produce,
      role: input.role,
    }),
  });

  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* sin cuerpo */
  }

  if (!res.ok || body.error) {
    const msg = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    if (/fetch|network|failed/i.test(msg)) {
      throw new Error('No se pudo contactar la función. En local, ¿está corriendo `npm run fn:serve`?');
    }
    throw new Error(msg);
  }

  return body as unknown as { ok: boolean; email: string };
}
