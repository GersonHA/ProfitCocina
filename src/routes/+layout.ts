/**
 * App cliente (SPA): sin SSR ni prerender. Lee la sesión y el grupo activo (el
 * primero del usuario, por ahora) y los pasa a todas las páginas.
 */
import { supabase } from '$lib/supabase';

export const ssr = false;
export const prerender = false;

export interface ActiveGroup {
  id: string;
  role: string;
  name: string;
  server: string;
}

export async function load() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, group: null };

  const { data } = await supabase
    .from('group_members')
    .select('group_id, role, groups(name, server)')
    .eq('user_id', session.user.id)
    .limit(1);

  const first = data?.[0];
  let group: ActiveGroup | null = null;
  if (first) {
    const g = Array.isArray(first.groups) ? first.groups[0] : first.groups;
    group = {
      id: first.group_id,
      role: first.role,
      name: g?.name ?? 'Grupo',
      server: g?.server ?? '',
    };
  }

  return { session, group };
}
