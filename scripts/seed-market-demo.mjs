/**
 * Siembra datos DEMO del mercado interno en la base LOCAL, para ver cómo luce
 * poblado: historial de costo de producción por miembro e item, ~18 días.
 *
 * Inserta en inventory_movements (source_table='demo') + inventory_balances.
 * Idempotente: borra primero lo marcado como 'demo'. Solo LOCAL.
 *
 *   node scripts/seed-market-demo.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = 'http://127.0.0.1:54321';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const db = createClient(URL, SERVICE);

// Set de producción por miembro (item_id, nombre, costo base). Hay solapes a
// propósito (Pan, Carne de ternera, Harina) para que el gráfico compare varios.
const MENUS = [
  { nick: 'Gerson', items: [['T4_BREAD', 30], ['T3_FLOUR', 24], ['T3_WHEAT', 10]] },
  { nick: 'Amigo A', items: [['T4_BREAD', 48], ['T8_MEAT', 280], ['T3_MEAT', 85]] },
  { nick: 'Amigo B', items: [['T8_PUMPKIN', 130], ['T8_MEAT', 335], ['T6_POTATO', 55]] },
  { nick: 'Amigo C', items: [['T1_CARROT', 18], ['T7_MEAT', 200], ['T3_FLOUR', 33]] },
];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const { data: grp } = await db.from('groups').select('id').limit(1).single();
  if (!grp) throw new Error('No hay grupo en la base local.');
  const groupId = grp.id;

  const { data: members } = await db
    .from('group_members')
    .select('user_id, role')
    .eq('group_id', groupId)
    .order('role', { ascending: true }); // admin primero
  if (!members?.length) throw new Error('El grupo no tiene miembros.');

  const DAYS = 18;
  const today = new Date();
  const dates = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(ymd(d));
  }

  // Limpia demo anterior.
  await db.from('inventory_movements').delete().eq('group_id', groupId).eq('source_table', 'demo');

  const movs = [];
  const balances = new Map(); // user|item -> last row
  let seq = 1_000_000_000;

  members.forEach((m, idx) => {
    const menu = MENUS[idx % MENUS.length];
    for (const [itemId, base] of menu.items) {
      // Cada serie arranca y se mueve distinto (nunca idénticas).
      let cost = base * (0.9 + Math.random() * 0.2);
      const trend = (Math.random() - 0.5) * 0.02; // tendencia propia ±2%/día
      for (const fecha of dates) {
        cost = Math.max(base * 0.5, cost * (1 + trend + (Math.random() - 0.5) * 0.2));
        const unit = Math.round(cost);
        const qty = Math.round(300 + Math.random() * 1400);
        const row = {
          group_id: groupId,
          user_id: m.user_id,
          item_id: itemId,
          fecha,
          seq: seq++,
          type: 'entrada_produccion',
          qty,
          unit_cost: unit,
          total_cost: qty * unit,
          bal_qty: qty,
          bal_avg_cost: unit,
          bal_value: qty * unit,
          source_table: 'demo',
          source_id: randomUUID(),
        };
        movs.push(row);
        balances.set(`${m.user_id}|${itemId}`, row);
      }
    }
  });

  // Inserta movimientos en lotes.
  for (let i = 0; i < movs.length; i += 500) {
    const { error } = await db.from('inventory_movements').insert(movs.slice(i, i + 500));
    if (error) throw error;
  }

  // Upsert de saldos (el último de cada user|item).
  const bal = [...balances.values()].map((r) => ({
    group_id: groupId,
    user_id: r.user_id,
    item_id: r.item_id,
    qty: r.bal_qty,
    avg_cost: r.bal_avg_cost,
    value: r.bal_value,
  }));
  const { error: be } = await db.from('inventory_balances').upsert(bal, { onConflict: 'group_id,user_id,item_id' });
  if (be) throw be;

  // Nombres (nick) para que el tablero se lea bonito.
  for (let i = 0; i < members.length; i++) {
    const nick = MENUS[i % MENUS.length].nick;
    await db.from('profiles').update({ nick }).eq('user_id', members[i].user_id);
  }

  console.log(`OK: ${movs.length} movimientos demo, ${bal.length} saldos, ${members.length} miembros (${dates[0]} → ${dates.at(-1)}).`);
}

main().catch((e) => {
  console.error('ERROR:', e.message ?? e);
  process.exit(1);
});
