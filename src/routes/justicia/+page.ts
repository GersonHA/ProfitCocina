/** Análisis de justicia: arma el período real y el de ejemplo (Test A). */
import { redirect } from '@sveltejs/kit';
import { buildExample, buildFromDb, type BuiltPeriod } from '$lib/periodData';

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, '/login');

  const example = buildExample();
  let real: BuiltPeriod | null = null;
  if (group) {
    try {
      real = await buildFromDb(group.id);
    } catch {
      real = null;
    }
  }

  return { group, example, real };
}
