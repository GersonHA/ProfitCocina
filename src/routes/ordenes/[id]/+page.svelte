<script lang="ts">
  import { base } from '$app/paths';
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { recompute } from '$lib/recompute';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  function hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function plano(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return Math.round(Number(n)).toLocaleString('es-ES', { useGrouping: 'always' });
  }
  const baseDe = (id: string) => id.split('@')[0];
  function calidad(id: string): string {
    const [base, e] = id.split('@');
    if (!e) return '';
    const t = base.match(/^T(\d)_/);
    return `${t ? t[1] : ''}.${e}`;
  }
  const nombre = (id: string) => data.names[baseDe(id)] ?? id;

  type Item = (typeof data.items)[number];
  const order = $derived(data.order);

  function lotesDe(item: Item) {
    return data.purchasesByItem[item.id] ?? [];
  }
  function comprado(item: Item) {
    return lotesDe(item).reduce((s, p) => s + Number(p.qty), 0);
  }
  function productoresDe(itemId: string) {
    const out: { id: string; nick: string; cost: number | null }[] = [];
    for (const m of data.members) {
      const pr = m.produces.find((x) => x.itemId === itemId);
      if (pr) out.push({ id: m.id, nick: m.nick, cost: pr.cost });
    }
    return out;
  }
  function origenLabel(p: { source: string; seller_id: string | null }) {
    if (p.source === 'external') return 'externo';
    if (p.source === 'propio') return 'propio';
    return `a ${data.nicks[p.seller_id ?? ''] ?? '—'}`;
  }

  const allComplete = $derived(data.items.length > 0 && data.items.every((it) => comprado(it) >= Number(it.qty)));
  const costoIngredientes = $derived(
    data.items.flatMap((it) => lotesDe(it)).reduce((s, p) => s + Number(p.qty) * (Number(p.unit_price) || 0), 0),
  );

  // Completado
  const costoTotal = $derived(costoIngredientes + (Number(order.cook_silver) || 0));
  const porPlatillo = $derived(Number(order.cook_output) > 0 ? costoTotal / Number(order.cook_output) : 0);

  // --- Estado del formulario de lote por ingrediente ---
  let abierto = $state<Record<string, boolean>>({});
  let fQty = $state<Record<string, number | null>>({});
  let fOrigen = $state<Record<string, string>>({});
  let fPrice = $state<Record<string, number | null>>({});
  let busy = $state<string | null>(null);
  let errorMsg = $state('');

  function precioPorOrigen(origen: string, itemId: string): number | null {
    if (origen === 'external') return null;
    return data.members.find((m) => m.id === origen)?.produces.find((x) => x.itemId === itemId)?.cost ?? null;
  }
  function toggleLote(item: Item) {
    const abrir = !abierto[item.id];
    abierto = { ...abierto, [item.id]: abrir };
    if (abrir) {
      const prods = productoresDe(item.item_id);
      const origen = prods[0]?.id ?? 'external';
      fOrigen = { ...fOrigen, [item.id]: origen };
      fQty = { ...fQty, [item.id]: Math.max(0, Number(item.qty) - comprado(item)) };
      fPrice = { ...fPrice, [item.id]: precioPorOrigen(origen, item.item_id) };
    }
  }
  function cambiarOrigen(item: Item, origen: string) {
    fOrigen = { ...fOrigen, [item.id]: origen };
    fPrice = { ...fPrice, [item.id]: precioPorOrigen(origen, item.item_id) };
  }

  async function registrarLote(item: Item, qty: number, origen: string, price: number | null) {
    if (!qty || qty <= 0) {
      errorMsg = 'Indica la cantidad del lote.';
      return;
    }
    busy = item.id;
    errorMsg = '';
    try {
      const gid = data.groupId;
      let source: 'member' | 'external' | 'propio';
      let seller_id: string | null = null;
      let trade_id: string | null = null;
      let txn_kind: string | null = null;

      if (origen === 'external') {
        source = 'external';
        const { data: t, error } = await supabase
          .from('market_txns')
          .insert({ group_id: gid, kind: 'buy', item_id: item.item_id, qty, price_unit: price ?? 0, taxes: 0, fecha: hoy() })
          .select('id')
          .single();
        if (error) throw error;
        trade_id = t.id;
        txn_kind = 'market';
      } else if (origen === data.meId) {
        source = 'propio'; // lo produces tú: ya está en tu inventario, sin compra
        seller_id = origen;
      } else {
        source = 'member';
        seller_id = origen;
        const { data: t, error } = await supabase
          .from('member_trades')
          .insert({ group_id: gid, seller_id: origen, buyer_id: data.meId, item_id: item.item_id, qty, price_unit: price ?? 0, fecha: hoy() })
          .select('id')
          .single();
        if (error) throw error;
        trade_id = t.id;
        txn_kind = 'member';
      }

      const { error: ep } = await supabase
        .from('order_purchases')
        .insert({ order_item_id: item.id, qty, source, seller_id, unit_price: price, trade_id, txn_kind });
      if (ep) throw ep;

      if (comprado(item) + qty >= Number(item.qty)) {
        await supabase.from('order_items').update({ bought: true }).eq('id', item.id);
      }
      if (source !== 'propio') await recompute(gid!);
      abierto = { ...abierto, [item.id]: false };
      await invalidateAll();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  // Compra rápida: el resto faltante desde la fuente del plan.
  function comprarRestante(item: Item) {
    const restante = Number(item.qty) - comprado(item);
    registrarLote(item, restante, item.source === 'external' ? 'external' : (item.seller_id ?? 'external'), item.unit_price);
  }

  async function pasarACocina() {
    busy = 'state';
    try {
      await supabase.from('production_orders').update({ state: 'cocina' }).eq('id', order.id);
      await invalidateAll();
    } finally {
      busy = null;
    }
  }

  let cookSilver = $state<number | null>(null);
  let cookOutput = $state<number | null>(null);
  async function completar() {
    if (cookOutput == null || cookOutput <= 0) {
      errorMsg = 'Indica cuántos platillos obtuviste.';
      return;
    }
    busy = 'cook';
    errorMsg = '';
    try {
      const gid = data.groupId;
      if (!gid) throw new Error('Sin grupo activo');
      const { data: proc, error } = await supabase
        .from('processes')
        .insert({ group_id: gid, fecha: hoy(), type: 'cocina' })
        .select('id')
        .single();
      if (error) throw error;
      const pid = proc.id;
      await supabase.from('process_inputs').insert(data.items.map((it) => ({ process_id: pid, item_id: it.item_id, qty: it.qty })));
      await supabase.from('process_outputs').insert({ process_id: pid, item_id: order.output_item, qty: cookOutput });
      await supabase.from('process_expenses').insert({ process_id: pid, silver: cookSilver ?? 0, kind: 'estacion' });
      await supabase
        .from('production_orders')
        .update({ state: 'completado', cook_process_id: pid, cook_silver: cookSilver ?? 0, cook_output: cookOutput })
        .eq('id', order.id);
      await recompute(gid);
      await invalidateAll();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  async function cancelar() {
    busy = 'state';
    try {
      await supabase.from('production_orders').update({ state: 'cancelado' }).eq('id', order.id);
      await invalidateAll();
    } finally {
      busy = null;
    }
  }
</script>

<section class="mx-auto max-w-3xl space-y-5">
  <div class="flex items-center justify-between">
    <a href="{base}/ordenes" class="text-sm text-stone-400 hover:text-stone-200">← Órdenes</a>
    <a href="{base}/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">🏠 Inicio</a>
  </div>

  <div class="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
    <ItemImg itemId={order.output_item} nombre={nombre(order.output_item)} size={44} />
    <div class="flex-1">
      <h1 class="text-xl font-semibold">
        {order.tandas}× {nombre(order.output_item)}
        {#if calidad(order.output_item)}<span class="text-amber-300">{calidad(order.output_item)}</span>{/if}
      </h1>
      <p class="text-xs text-stone-500">
        {#if order.state === 'compras'}Paso 1 de 2 · Consigue los ingredientes (por lotes)
        {:else if order.state === 'cocina'}Paso 2 de 2 · Cocina y registra
        {:else if order.state === 'completado'}Completado
        {:else}{order.state}{/if}
      </p>
    </div>
    {#if data.isOwner && order.state !== 'completado' && order.state !== 'cancelado'}
      <button onclick={cancelar} class="rounded-lg border border-stone-700 px-2.5 py-1 text-xs text-stone-400 hover:bg-stone-800">Cancelar</button>
    {/if}
  </div>

  {#if errorMsg}<p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMsg}</p>{/if}

  <div class="flex items-center gap-2 text-xs">
    {#each [['compras', 'Compras'], ['cocina', 'Cocina'], ['completado', 'Listo']] as [k, lbl]}
      {@const done = (order.state === 'cocina' && k === 'compras') || (order.state === 'completado' && k !== 'cancelado')}
      <span class="rounded-full px-2.5 py-1 {order.state === k ? 'bg-amber-500 text-stone-950' : done ? 'bg-green-500/15 text-green-300' : 'bg-stone-800 text-stone-500'}">{lbl}</span>
      {#if k !== 'completado'}<span class="text-stone-600">→</span>{/if}
    {/each}
  </div>

  <!-- COMPRAS -->
  {#if order.state === 'compras'}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">Ingredientes a conseguir (por lotes)</h2>
      <div class="space-y-3">
        {#each data.items as it}
          {@const comp = comprado(it)}
          {@const restante = Number(it.qty) - comp}
          {@const prods = productoresDe(it.item_id)}
          {@const listo = comp >= Number(it.qty)}
          <div class="rounded-xl border {listo ? 'border-green-500/30' : 'border-stone-800'} bg-stone-950/40 p-3">
            <div class="flex items-center gap-3">
              <ItemImg itemId={it.item_id} nombre={nombre(it.item_id)} size={28} />
              <div class="min-w-0 flex-1">
                <p class="text-sm"><span class="tabular-nums text-stone-400">{plano(it.qty)}×</span> {nombre(it.item_id)}</p>
                <p class="text-xs text-stone-500">comprado {plano(comp)} / {plano(it.qty)}{#if !listo} · faltan {plano(restante)}{/if}</p>
              </div>
              {#if listo}
                <span class="rounded-full bg-green-500/15 px-2.5 py-1 text-xs text-green-300">✓ Listo</span>
              {/if}
            </div>

            <!-- Lotes ya comprados -->
            {#if lotesDe(it).length > 0}
              <ul class="mt-2 space-y-0.5 pl-10 text-xs text-stone-500">
                {#each lotesDe(it) as p}
                  <li>· {plano(p.qty)}× {origenLabel(p)} a {plano(p.unit_price)} c/u = {plano(Number(p.qty) * (Number(p.unit_price) || 0))}</li>
                {/each}
              </ul>
            {/if}

            {#if data.isOwner && !listo}
              <div class="mt-2 flex flex-wrap items-center gap-2 pl-10">
                <button
                  onclick={() => comprarRestante(it)}
                  disabled={busy === it.id}
                  class="rounded-lg bg-sky-500/90 px-3 py-1.5 text-xs font-medium text-stone-950 hover:bg-sky-400 disabled:opacity-50"
                >
                  {busy === it.id ? 'Registrando…' : `Comprar ${plano(restante)} restantes (${it.source === 'external' ? 'externo' : it.seller_id === data.meId ? 'propio' : (data.nicks[it.seller_id ?? ''] ?? 'plan')} a ${plano(it.unit_price)})`}
                </button>
                <button onclick={() => toggleLote(it)} class="rounded-lg border border-stone-700 px-2.5 py-1.5 text-xs text-stone-300 hover:bg-stone-800">
                  {abierto[it.id] ? 'Cerrar' : '＋ Otro origen / precio'}
                </button>
              </div>

              {#if abierto[it.id]}
                <div class="mt-2 ml-10 flex flex-wrap items-end gap-2 rounded-lg bg-stone-900 p-2">
                  <label class="block">
                    <span class="mb-0.5 block text-[10px] text-stone-500">Cantidad</span>
                    <input type="number" bind:value={fQty[it.id]} min="1" class="w-24 rounded border border-stone-700 bg-stone-950 px-2 py-1 text-sm tabular-nums" />
                  </label>
                  <label class="block">
                    <span class="mb-0.5 block text-[10px] text-stone-500">Origen</span>
                    <select
                      value={fOrigen[it.id]}
                      onchange={(e) => cambiarOrigen(it, e.currentTarget.value)}
                      class="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-sm"
                    >
                      {#each prods as pr}
                        <option value={pr.id}>{pr.id === data.meId ? 'tú (propio)' : pr.nick} · {plano(pr.cost)}</option>
                      {/each}
                      <option value="external">Externo (mercado)</option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="mb-0.5 block text-[10px] text-stone-500">Precio c/u</span>
                    <input type="number" bind:value={fPrice[it.id]} min="0" class="w-24 rounded border border-stone-700 bg-stone-950 px-2 py-1 text-sm tabular-nums" />
                  </label>
                  <button
                    onclick={() => registrarLote(it, Number(fQty[it.id]) || 0, fOrigen[it.id], fPrice[it.id])}
                    disabled={busy === it.id}
                    class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    Registrar lote
                  </button>
                </div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
      <p class="mt-3 text-xs text-stone-500">Cada lote registra el movimiento real (entra a tu inventario a ese precio); el costo se mezcla solo. Lo que tú produces no se compra.</p>

      {#if data.isOwner}
        <button
          onclick={pasarACocina}
          disabled={!allComplete || busy === 'state'}
          class="mt-4 w-full rounded-xl bg-amber-500 px-4 py-2.5 font-semibold text-stone-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allComplete ? 'Pasar a cocina →' : 'Faltan ingredientes por completar'}
        </button>
      {/if}
    </div>
  {/if}

  <!-- COCINA -->
  {#if order.state === 'cocina'}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <h2 class="mb-1 text-sm font-medium tracking-wide text-stone-400 uppercase">Cocina — registra el total del puesto</h2>
      <p class="mb-3 text-xs text-stone-500">
        Ingredientes listos (costo {plano(costoIngredientes)}). Registra el <span class="text-stone-300">silver gastado</span> en estación y los <span class="text-stone-300">platillos obtenidos</span> (ya con la devolución del puesto).
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Silver gastado en estación</span>
          <input type="number" bind:value={cookSilver} min="0" placeholder="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 tabular-nums" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Platillos obtenidos</span>
          <input type="number" bind:value={cookOutput} min="1" placeholder="ej. 500" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 tabular-nums" />
        </label>
      </div>
      {#if data.isOwner}
        <button onclick={completar} disabled={busy === 'cook'} class="mt-4 w-full rounded-xl bg-green-500 px-4 py-2.5 font-semibold text-stone-950 hover:bg-green-400 disabled:opacity-50">
          {busy === 'cook' ? 'Registrando…' : 'Registrar cocina y completar ✓'}
        </button>
      {/if}
    </div>
  {/if}

  <!-- COMPLETADO -->
  {#if order.state === 'completado'}
    <div class="space-y-1.5 rounded-2xl border border-stone-800 bg-stone-900/50 p-5 text-sm">
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Resultado</h2>
      <div class="flex justify-between"><span class="text-stone-400">Costo de ingredientes (real)</span><span class="tabular-nums">{plano(costoIngredientes)}</span></div>
      <div class="flex justify-between"><span class="text-stone-400">Silver en estación</span><span class="tabular-nums">{plano(order.cook_silver)}</span></div>
      <div class="flex justify-between border-t border-stone-800 pt-1.5"><span class="text-stone-400">Inversión total</span><span class="font-semibold tabular-nums">{plano(costoTotal)}</span></div>
      <div class="flex justify-between"><span class="text-stone-400">Platillos obtenidos</span><span class="font-semibold tabular-nums">{plano(order.cook_output)}</span></div>
      <div class="flex justify-between"><span class="text-stone-400">Costo real por platillo</span><span class="font-semibold tabular-nums text-amber-300">{plano(porPlatillo)}</span></div>
      <p class="pt-1 text-xs text-stone-500">La ganancia la ves al vender el platillo (módulo Vender).</p>
    </div>

    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Trazabilidad (lotes)</h2>
      <ul class="space-y-1 text-xs text-stone-400">
        {#each data.items as it}
          {#each lotesDe(it) as p}
            <li>✓ {plano(p.qty)}× {nombre(it.item_id)} {origenLabel(p)} a {plano(p.unit_price)} = {plano(Number(p.qty) * (Number(p.unit_price) || 0))}</li>
          {/each}
        {/each}
        <li>🍳 Cocina: {plano(order.cook_silver)} silver → {plano(order.cook_output)} platillos</li>
      </ul>
      <p class="mt-3 text-xs text-stone-500">Los platillos ya están en tu inventario con este costo. Véndelos donde prefieras.</p>
    </div>

    <div class="flex flex-wrap gap-2">
      <a href="{base}/" class="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-center font-semibold text-stone-950 hover:bg-amber-400">🏠 Ir al inicio</a>
      <a href="{base}/ordenes" class="flex-1 rounded-xl border border-stone-700 px-4 py-2.5 text-center font-medium text-stone-300 hover:bg-stone-800">Ver mis órdenes</a>
    </div>
  {/if}

  {#if order.state === 'cancelado'}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">Esta orden fue cancelada.</p>
  {/if}
</section>
