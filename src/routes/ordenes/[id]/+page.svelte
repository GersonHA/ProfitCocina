<script lang="ts">
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
    return Math.round(Number(n)).toLocaleString('es-ES');
  }
  function baseDe(id: string): string {
    return id.split('@')[0];
  }
  function calidad(id: string): string {
    const [base, e] = id.split('@');
    if (!e) return '';
    const t = base.match(/^T(\d)_/);
    return `${t ? t[1] : ''}.${e}`;
  }
  function nombre(id: string): string {
    return data.names[baseDe(id)] ?? id;
  }

  let busy = $state<string | null>(null);
  let errorMsg = $state('');
  let cookSilver = $state<number | null>(null);
  let cookOutput = $state<number | null>(null);

  const order = $derived(data.order);
  const allBought = $derived(data.items.length > 0 && data.items.every((i) => i.bought));
  const costoIngredientes = $derived(data.items.reduce((s, i) => s + Number(i.qty) * (Number(i.unit_price) || 0), 0));
  const costoComprado = $derived(
    data.items.filter((i) => i.bought).reduce((s, i) => s + Number(i.qty) * (Number(i.unit_price) || 0), 0),
  );

  // Resumen de completado
  const costoTotal = $derived(costoIngredientes + (Number(order.cook_silver) || 0));
  const porPlatillo = $derived(Number(order.cook_output) > 0 ? costoTotal / Number(order.cook_output) : 0);
  const ganancia = $derived(data.mealPrice != null ? data.mealPrice - porPlatillo : null);

  async function marcarComprado(it: (typeof data.items)[number]) {
    busy = it.id;
    errorMsg = '';
    try {
      const gid = data.groupId;
      if (!gid) throw new Error('Sin grupo activo');
      let trade_id: string | null = null;
      let txn_kind: string | null = null;
      if (it.source === 'member' && it.seller_id === data.meId) {
        // Lo produces tú: ya está en tu inventario, no hay compra que registrar.
        txn_kind = 'propio';
        await supabase.from('order_items').update({ bought: true, txn_kind }).eq('id', it.id);
        await invalidateAll();
        busy = null;
        return;
      }
      if (it.source === 'member') {
        const { data: t, error } = await supabase
          .from('member_trades')
          .insert({
            group_id: data.groupId,
            seller_id: it.seller_id,
            buyer_id: data.meId,
            item_id: it.item_id,
            qty: it.qty,
            price_unit: it.unit_price ?? 0,
            fecha: hoy(),
          })
          .select('id')
          .single();
        if (error) throw error;
        trade_id = t.id;
        txn_kind = 'member';
      } else {
        const { data: t, error } = await supabase
          .from('market_txns')
          .insert({
            group_id: data.groupId,
            kind: 'buy',
            item_id: it.item_id,
            qty: it.qty,
            price_unit: it.unit_price ?? 0,
            taxes: 0,
            fecha: hoy(),
          })
          .select('id')
          .single();
        if (error) throw error;
        trade_id = t.id;
        txn_kind = 'market';
      }
      await supabase.from('order_items').update({ bought: true, trade_id, txn_kind }).eq('id', it.id);
      await recompute(gid);
      await invalidateAll();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  async function pasarACocina() {
    busy = 'state';
    errorMsg = '';
    try {
      await supabase.from('production_orders').update({ state: 'cocina', updated_at: new Date().toISOString() }).eq('id', order.id);
      await invalidateAll();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

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
        .update({ state: 'completado', cook_process_id: pid, cook_silver: cookSilver ?? 0, cook_output: cookOutput, updated_at: new Date().toISOString() })
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
  <a href="/ordenes" class="text-sm text-stone-400 hover:text-stone-200">← Órdenes</a>

  <!-- Encabezado -->
  <div class="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
    <ItemImg itemId={order.output_item} nombre={nombre(order.output_item)} size={44} />
    <div class="flex-1">
      <h1 class="text-xl font-semibold">
        {order.tandas}× {nombre(order.output_item)}
        {#if calidad(order.output_item)}<span class="text-amber-300">{calidad(order.output_item)}</span>{/if}
      </h1>
      <p class="text-xs text-stone-500">
        {#if order.state === 'compras'}Paso 1 de 2 · Consigue los ingredientes
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

  <!-- Pasos -->
  <div class="flex items-center gap-2 text-xs">
    {#each [['compras', 'Compras'], ['cocina', 'Cocina'], ['completado', 'Listo']] as [k, lbl]}
      {@const done = (order.state === 'cocina' && k === 'compras') || (order.state === 'completado' && k !== 'cancelado')}
      <span class="rounded-full px-2.5 py-1 {order.state === k ? 'bg-amber-500 text-stone-950' : done ? 'bg-green-500/15 text-green-300' : 'bg-stone-800 text-stone-500'}">{lbl}</span>
      {#if k !== 'completado'}<span class="text-stone-600">→</span>{/if}
    {/each}
  </div>

  <!-- ESTADO: COMPRAS -->
  {#if order.state === 'compras'}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">Ingredientes a conseguir</h2>
      <div class="divide-y divide-stone-800">
        {#each data.items as it}
          {@const mio = it.source === 'member' && it.seller_id === data.meId}
          <div class="flex items-center gap-3 py-2.5">
            <ItemImg itemId={it.item_id} nombre={nombre(it.item_id)} size={30} />
            <div class="min-w-0 flex-1">
              <p class="text-sm"><span class="tabular-nums text-stone-400">{plano(it.qty)}×</span> {nombre(it.item_id)}</p>
              <p class="text-xs text-stone-500">
                {#if it.source === 'external'}<span class="text-sky-300">compra externa</span>{:else if mio}lo produces tú{:else}a {data.nicks[it.seller_id] ?? '—'}{/if}
                · {plano(it.unit_price)} c/u · {plano(Number(it.qty) * (Number(it.unit_price) || 0))} total
              </p>
            </div>
            {#if it.bought}
              <span class="rounded-full bg-green-500/15 px-2.5 py-1 text-xs text-green-300">{mio ? '✓ Listo' : '✓ Comprado'}</span>
            {:else if data.isOwner}
              <button
                onclick={() => marcarComprado(it)}
                disabled={busy === it.id}
                class="rounded-lg bg-sky-500/90 px-3 py-1.5 text-xs font-medium text-stone-950 hover:bg-sky-400 disabled:opacity-50"
              >
                {busy === it.id ? 'Registrando…' : mio ? 'Marcar listo' : 'Marcar comprado'}
              </button>
            {:else}
              <span class="text-xs text-stone-500">pendiente</span>
            {/if}
          </div>
        {/each}
      </div>
      <p class="mt-3 text-xs text-stone-500">Al marcar comprado se registra el movimiento (entra a tu inventario al costo). Hazlo tras hacer el trade en el juego.</p>

      {#if data.isOwner}
        <button
          onclick={pasarACocina}
          disabled={!allBought || busy === 'state'}
          class="mt-4 w-full rounded-xl bg-amber-500 px-4 py-2.5 font-semibold text-stone-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allBought ? 'Pasar a cocina →' : `Faltan ${data.items.filter((i) => !i.bought).length} ingredientes`}
        </button>
      {/if}
    </div>
  {/if}

  <!-- ESTADO: COCINA -->
  {#if order.state === 'cocina'}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <h2 class="mb-1 text-sm font-medium tracking-wide text-stone-400 uppercase">Cocina — registra el total del puesto</h2>
      <p class="mb-3 text-xs text-stone-500">
        Ingredientes listos (costo {plano(costoIngredientes)}). Cocina en el juego y registra el <span class="text-stone-300">silver gastado</span> en estación y los <span class="text-stone-300">platillos obtenidos</span> (ya con la devolución del puesto).
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Silver gastado en estación</span>
          <input type="number" bind:value={cookSilver} min="0" placeholder="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 tabular-nums" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Platillos obtenidos</span>
          <input type="number" bind:value={cookOutput} min="1" placeholder="ej. 60" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 tabular-nums" />
        </label>
      </div>
      {#if data.isOwner}
        <button
          onclick={completar}
          disabled={busy === 'cook'}
          class="mt-4 w-full rounded-xl bg-green-500 px-4 py-2.5 font-semibold text-stone-950 hover:bg-green-400 disabled:opacity-50"
        >
          {busy === 'cook' ? 'Registrando…' : 'Registrar cocina y completar ✓'}
        </button>
      {/if}
    </div>
  {/if}

  <!-- ESTADO: COMPLETADO -->
  {#if order.state === 'completado'}
    <div class="space-y-1.5 rounded-2xl border border-stone-800 bg-stone-900/50 p-5 text-sm">
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Resultado</h2>
      <div class="flex justify-between"><span class="text-stone-400">Costo de ingredientes</span><span class="tabular-nums">{plano(costoIngredientes)}</span></div>
      <div class="flex justify-between"><span class="text-stone-400">Silver en estación</span><span class="tabular-nums">{plano(order.cook_silver)}</span></div>
      <div class="flex justify-between border-t border-stone-800 pt-1.5"><span class="text-stone-400">Inversión total</span><span class="font-semibold tabular-nums">{plano(costoTotal)}</span></div>
      <div class="flex justify-between"><span class="text-stone-400">Platillos obtenidos</span><span class="font-semibold tabular-nums">{plano(order.cook_output)}</span></div>
      <div class="flex justify-between"><span class="text-stone-400">Costo real por platillo</span><span class="font-semibold tabular-nums text-amber-300">{plano(porPlatillo)}</span></div>
      <div class="flex justify-between border-t border-stone-800 pt-1.5"><span class="text-stone-400">Precio de mercado</span><span class="tabular-nums text-stone-300">{data.mealPrice != null ? plano(data.mealPrice) : 'sin dato'}</span></div>
      {#if ganancia != null}
        <div class="flex justify-between"><span class="text-stone-400">Ganancia por platillo</span><span class="font-semibold tabular-nums {ganancia >= 0 ? 'text-green-300' : 'text-red-300'}">{ganancia >= 0 ? '+' : ''}{plano(ganancia)}</span></div>
      {/if}
    </div>

    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Trazabilidad</h2>
      <ul class="space-y-1 text-xs text-stone-400">
        {#each data.items as it}
          <li>✓ Compra de {plano(it.qty)}× {nombre(it.item_id)} {#if it.source === 'external'}(externa){:else}a {data.nicks[it.seller_id] ?? '—'}{/if} · {plano(Number(it.qty) * (Number(it.unit_price) || 0))}</li>
        {/each}
        <li>🍳 Cocina: {plano(order.cook_silver)} silver → {plano(order.cook_output)} platillos</li>
      </ul>
      <p class="mt-3 text-xs text-stone-500">Los platillos ya están en tu inventario con este costo. Véndelos donde prefieras.</p>
    </div>
  {/if}

  {#if order.state === 'cancelado'}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">Esta orden fue cancelada.</p>
  {/if}
</section>
