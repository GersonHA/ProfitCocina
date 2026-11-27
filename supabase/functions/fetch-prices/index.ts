/**
 * Edge Function `fetch-prices`
 *
 * Rellena `price_snapshots` con los precios y volúmenes del DÍA ANTERIOR desde
 * el Albion Online Data Project (AODP), para todas las ciudades. Pensada para
 * correr una vez al día vía pg_cron (ver la migración del cron).
 *
 * Fuente: https://www.albion-online-data.com/  (servidor americas = "west").
 * Datos COLABORATIVOS: lo que no tenga scans queda sin precio (normal).
 *
 * Protección: requiere el header `x-cron-secret` == env CRON_SECRET.
 * Escribe con service_role (bypassa RLS). source='api'.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AODP = 'https://west.albion-online-data.com/api/v2/stats';
const CITIES = ['Caerleon', 'Martlock', 'Fort Sterling', 'Thetford', 'Lymhurst', 'Bridgewatch', 'Brecilien'];
const BATCH = 50; // items por llamada
const SERVER = 'americas';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch con reintento ante throttling de AODP. */
async function aodp(url: string, tries = 4): Promise<unknown[]> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'Accept-Encoding': 'gzip', 'User-Agent': 'ProfitCocina/1.0 (price-sync)' } });
    const text = await res.text();
    if (res.ok && text.trim().startsWith('[')) {
      try {
        return JSON.parse(text);
      } catch {
        return [];
      }
    }
    // Throttled u otro: espera creciente y reintenta.
    await sleep(3000 * (i + 1));
  }
  return [];
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function mdy(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const secret = Deno.env.get('CRON_SECRET');
    if (secret && req.headers.get('x-cron-secret') !== secret) {
      return json({ error: 'No autorizado' }, 401);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service);

    // Día objetivo: ayer (1 día de atraso). Permite override ?date=YYYY-MM-DD.
    const reqUrl = new URL(req.url);
    const override = reqUrl.searchParams.get('date');
    const target = override ? new Date(override + 'T00:00:00Z') : new Date(Date.now() - 86400000);
    const fecha = ymd(target);
    const histDate = mdy(target);

    // Items del catálogo.
    const { data: items, error: itErr } = await admin.from('items').select('item_id');
    if (itErr) return json({ error: itErr.message }, 400);
    const ids = (items ?? []).map((i) => i.item_id as string);
    if (ids.length === 0) return json({ error: 'Catálogo vacío' }, 400);

    const loc = CITIES.join(',');
    // Acumula por clave item|city.
    const rows = new Map<string, { item_id: string; city: string; sell: number | null; buy: number | null; vol: number | null; avg: number | null }>();
    const key = (it: string, c: string) => `${it}|${c}`;
    const get = (it: string, c: string) => {
      const k = key(it, c);
      let r = rows.get(k);
      if (!r) {
        r = { item_id: it, city: c, sell: null, buy: null, vol: null, avg: null };
        rows.set(k, r);
      }
      return r;
    };

    // 1) Precios actuales (sell_min / buy_max).
    for (const group of chunk(ids, BATCH)) {
      const data = (await aodp(`${AODP}/prices/${group.join(',')}?locations=${encodeURIComponent(loc)}&qualities=1`)) as Array<{
        item_id: string; city: string; sell_price_min: number; buy_price_max: number;
      }>;
      for (const d of data) {
        const r = get(d.item_id, d.city);
        if (d.sell_price_min > 0) r.sell = d.sell_price_min;
        if (d.buy_price_max > 0) r.buy = d.buy_price_max;
      }
      await sleep(1500);
    }

    // 2) Histórico del día (volumen + precio promedio).
    for (const group of chunk(ids, BATCH)) {
      const data = (await aodp(
        `${AODP}/history/${group.join(',')}?locations=${encodeURIComponent(loc)}&qualities=1&time-scale=24&date=${histDate}`,
      )) as Array<{ item_id: string; location: string; data: Array<{ item_count: number; avg_price: number; timestamp: string }> }>;
      for (const d of data) {
        const point = (d.data ?? []).find((p) => (p.timestamp ?? '').startsWith(fecha)) ?? (d.data ?? [])[0];
        if (!point) continue;
        const r = get(d.item_id, d.location);
        if (point.item_count > 0) r.vol = point.item_count;
        if (point.avg_price > 0) r.avg = point.avg_price;
      }
      await sleep(1500);
    }

    // Solo filas con algún dato.
    const toInsert = [...rows.values()]
      .filter((r) => r.sell != null || r.buy != null || r.vol != null)
      .map((r) => ({
        item_id: r.item_id,
        city: r.city,
        server: SERVER,
        sell_order_min: r.sell,
        buy_order_max: r.buy,
        avg24: r.avg,
        volume: r.vol,
        fecha,
        source: 'api',
      }));

    // Idempotente: borra lo de la API de ese día y reinserta.
    const { error: delErr } = await admin.from('price_snapshots').delete().eq('source', 'api').eq('server', SERVER).eq('fecha', fecha);
    if (delErr) return json({ error: delErr.message }, 400);

    let inserted = 0;
    for (const part of chunk(toInsert, 500)) {
      const { error: insErr } = await admin.from('price_snapshots').insert(part);
      if (insErr) return json({ error: insErr.message, insertedSoFar: inserted }, 400);
      inserted += part.length;
    }

    return json({ ok: true, fecha, items: ids.length, filas: inserted });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
