/**
 * Edge Function `recompute`
 *
 * Recalcula el Kardex de un (usuario, grupo): lee los eventos de dominio del
 * usuario (procesos, compras entre miembros, mercado, ajustes) con su propia
 * sesión (RLS), corre el MISMO motor de costos que el Test D (src/lib/core) y
 * escribe la proyección (movimientos + saldos) de forma atómica con la RPC
 * apply_kardex usando la service_role.
 *
 * Entrada (POST, JSON): { "group_id": "<uuid>" }
 * Salida: { ok, items, movements } o { error }.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runEngine } from '../../../src/lib/core/index.ts';
import type { LedgerEvent } from '../../../src/lib/core/types.ts';

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

    const { group_id: groupId } = await req.json().catch(() => ({}));
    if (!groupId) return json({ error: 'Falta group_id' }, 400);

    // Cliente con la sesión del usuario: solo lee lo que su RLS permite.
    const user = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: auth, error: authErr } = await user.auth.getUser();
    if (authErr || !auth.user) return json({ error: 'No autenticado' }, 401);
    const uid = auth.user.id;

    // --- Leer los eventos de dominio del usuario en el grupo ---
    const [procRes, marketRes, adjRes, tradeRes] = await Promise.all([
      user
        .from('processes')
        .select(
          'id, type, fecha, seq, process_inputs(item_id, qty), process_outputs(item_id, qty, role, valuation), process_expenses(silver)',
        )
        .eq('group_id', groupId)
        .eq('user_id', uid),
      user
        .from('market_txns')
        .select('id, item_id, qty, price_unit, kind, fecha, seq, status')
        .eq('group_id', groupId)
        .eq('user_id', uid),
      user
        .from('stock_adjustments')
        .select('id, item_id, qty_delta, unit_cost, reason, fecha, seq')
        .eq('group_id', groupId)
        .eq('user_id', uid),
      user
        .from('member_trades')
        .select('id, seller_id, buyer_id, item_id, qty, price_unit, fecha, seq')
        .eq('group_id', groupId)
        .or(`seller_id.eq.${uid},buyer_id.eq.${uid}`),
    ]);

    for (const r of [procRes, marketRes, adjRes, tradeRes]) {
      if (r.error) return json({ error: r.error.message }, 400);
    }

    // --- Traducir a eventos del motor ---
    const events: LedgerEvent[] = [];

    for (const p of procRes.data ?? []) {
      const expenses = (p.process_expenses ?? []).reduce(
        (s: number, e: { silver: number }) => s + (Number(e.silver) || 0),
        0,
      );
      events.push({
        kind: 'process',
        id: p.id,
        ts: p.fecha,
        seq: Number(p.seq),
        userId: uid,
        type: p.type,
        inputs: (p.process_inputs ?? []).map((i: { item_id: string; qty: number }) => ({
          itemId: i.item_id,
          qty: Number(i.qty),
        })),
        expenses,
        outputs: (p.process_outputs ?? []).map(
          (o: { item_id: string; qty: number; role: string; valuation: number | null }) => ({
            itemId: o.item_id,
            qty: Number(o.qty),
            role: o.role === 'subproducto' ? 'subproducto' : 'principal',
            valuation: o.valuation == null ? undefined : Number(o.valuation),
          }),
        ),
      });
    }

    for (const m of marketRes.data ?? []) {
      // Una venta solo descuenta inventario cuando está 'vendido'. Si está
      // 'en_venta' (listada) sigue siendo tuya; si está 'cancelado' ya volvió.
      if (m.kind === 'sell' && m.status && m.status !== 'vendido') continue;
      events.push({
        kind: 'market_txn',
        id: m.id,
        ts: m.fecha,
        seq: Number(m.seq),
        userId: uid,
        itemId: m.item_id,
        qty: Number(m.qty),
        priceUnit: Number(m.price_unit),
        direction: m.kind === 'sell' ? 'sell' : 'buy',
      });
    }

    for (const a of adjRes.data ?? []) {
      events.push({
        kind: 'adjustment',
        id: a.id,
        ts: a.fecha,
        seq: Number(a.seq),
        userId: uid,
        itemId: a.item_id,
        qtyDelta: Number(a.qty_delta),
        unitCost: a.unit_cost == null ? undefined : Number(a.unit_cost),
        reason: a.reason,
      });
    }

    for (const t of tradeRes.data ?? []) {
      events.push({
        kind: 'member_trade',
        id: t.id,
        ts: t.fecha,
        seq: Number(t.seq),
        sellerId: t.seller_id,
        buyerId: t.buyer_id,
        itemId: t.item_id,
        qty: Number(t.qty),
        priceUnit: Number(t.price_unit),
      });
    }

    // --- Correr el motor ---
    const result = runEngine(events);

    const movements = result.movements
      .filter((mv) => mv.userId === uid)
      .map((mv) => ({
        item_id: mv.itemId,
        fecha: mv.ts,
        seq: mv.seq,
        type: mv.type,
        qty: mv.qty,
        unit_cost: mv.unitCost,
        total_cost: mv.totalCost,
        bal_qty: mv.balQty,
        bal_avg_cost: mv.balAvgCost,
        bal_value: mv.balValue,
        source_table: mv.sourceType,
        source_id: mv.sourceId,
      }));

    const prefix = `${uid}::`;
    const balances = Object.entries(result.balances)
      .filter(([key, b]) => key.startsWith(prefix) && Math.abs(b.qty) > 1e-6)
      .map(([key, b]) => ({
        item_id: key.slice(prefix.length),
        qty: b.qty,
        avg_cost: b.qty > 0 ? b.value / b.qty : 0,
        value: b.value,
      }));

    // --- Escribir la proyección atómicamente (service_role) ---
    const admin = createClient(url, service);
    const { error: applyErr } = await admin.rpc('apply_kardex', {
      p_user: uid,
      p_group: groupId,
      p_movements: movements,
      p_balances: balances,
    });
    if (applyErr) return json({ error: applyErr.message }, 400);

    // Solo nos importan los errores del usuario recalculado. En una compra entre
    // miembros el motor también toca al vendedor; como aquí no cargamos la
    // producción del vendedor, su "stock negativo" es espurio y se descarta.
    const errors = result.errors.filter((e) => e.userId === uid);

    return json({
      ok: true,
      items: balances.length,
      movements: movements.length,
      errors,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
