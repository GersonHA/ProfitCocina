/**
 * Pantalla de inicio: requiere sesión. Trae tu perfil, tus grupos y, del primer
 * grupo, el equipo (quién produce qué). Dos consultas para el roster porque no
 * hay FK directa entre group_members y profiles; RLS permite ver a tus
 * compañeros de grupo (shares_group).
 */
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

interface RosterRow {
  userId: string;
  nick: string;
  produce: string;
  role: string;
}

interface MembershipRow {
  role: string;
  groupId: string;
  name: string;
  server: string;
}

/** El join embebido de PostgREST puede venir como objeto o como array: lo normalizamos. */
function oneGroup(g: unknown): { name?: string; server?: string } | null {
  if (!g) return null;
  return Array.isArray(g) ? (g[0] ?? null) : (g as { name?: string; server?: string });
}

export async function load() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect(303, '/login');

  const me = session.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('nick, premium, especializaciones')
    .eq('user_id', me)
    .single();

  const { data: membershipsRaw } = await supabase
    .from('group_members')
    .select('role, group_id, groups(name, server)')
    .eq('user_id', me);

  const memberships: MembershipRow[] = (membershipsRaw ?? []).map((m) => {
    const g = oneGroup(m.groups);
    return {
      role: m.role,
      groupId: m.group_id,
      name: g?.name ?? 'Grupo',
      server: g?.server ?? '',
    };
  });

  let groupName: string | null = null;
  let roster: RosterRow[] = [];

  const first = memberships[0];
  if (first) {
    groupName = first.name;

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', first.groupId);

    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, nick, especializaciones')
      .in('user_id', ids);

    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    roster = (members ?? []).map((m) => {
      const p = byId.get(m.user_id);
      const esp = (p?.especializaciones ?? {}) as { produce?: string };
      return {
        userId: m.user_id,
        nick: p?.nick ?? '—',
        produce: esp.produce ?? '—',
        role: m.role,
      };
    });
  }

  const esp = (profile?.especializaciones ?? {}) as { produce?: string };

  return {
    email: session.user.email ?? '',
    meId: me,
    groupId: first?.groupId ?? null,
    nick: profile?.nick ?? null,
    premium: profile?.premium ?? true,
    produce: esp.produce ?? null,
    memberships,
    groupName,
    roster,
  };
}
