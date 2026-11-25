/**
 * Llama a la Edge Function `recompute`, que recalcula el Kardex del usuario en
 * un grupo (corre el motor de costos en el servidor y escribe la proyección).
 *
 * En local necesita el runtime de funciones corriendo: `npm run fn:serve`.
 * En producción está siempre disponible en {SUPABASE_URL}/functions/v1/recompute.
 */
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { supabase } from '$lib/supabase';

export interface RecomputeResult {
  ok: boolean;
  items: number;
  movements: number;
  errors: unknown[];
}

export async function recompute(groupId: string): Promise<RecomputeResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay sesión activa.');

  const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/recompute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ group_id: groupId }),
  });

  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }

  if (!res.ok || body.error) {
    const msg = typeof body.error === 'string' ? body.error : `recompute HTTP ${res.status}`;
    if (/fetch|network|failed/i.test(msg)) {
      throw new Error('No se pudo contactar la función recompute. En local, ¿está corriendo `npm run fn:serve`?');
    }
    throw new Error(msg);
  }

  return body as unknown as RecomputeResult;
}
