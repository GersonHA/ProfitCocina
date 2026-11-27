<script lang="ts">
  import { base } from '$app/paths';
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { recompute } from '$lib/recompute';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import type { SellRow } from './+page';

  let { data } = $props();

  const CIUDADES = ['Caerleon', 'Martlock', 'Fort Sterling', 'Thetford', 'Lymhurst', 'Bridgewatch', 'Brecilien'];

  const ESTADO: Record<string, { label: string; clase: string }> = {
    en_venta: { label: 'En venta', clase: 'bg-amber-500/15 text-amber-300' },
    vendido: { label: 'Vendido', clase: 'bg-green-500/15 text-green-300' },
    cancelado: { label: 'Cancelado', clase: 'bg-stone-700/40 text-stone-400' },
  };

  function hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function firstItem(): string {
    return data.inventory[0]?.item_id ?? '';
  }
  function nombre(id: string): string {
    return data.inventory.find((i) => i.item_id === id)?.name_es ?? id;
  }
  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });
  // Extrae un mensaje legible de un Error o de un error de Supabase (objeto con .message).
  function emsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
    return String(e);
  }

  let itemId = $state(firstItem());
  let qty = $state<number | null>(null);
  let priceUnit = $state<number | null>(null);
  let city = $state('Caerleon');
  let orderType = $state<'sell_order' | 'instant'>('sell_order');
  let fecha = $state(hoy());

  // Cantidad ya listada (en_venta) de un item: no se puede volver a listar.
  function pendienteDe(id: string): number {
    return data.sells.filter((s) => s.item_id === id && s.status === 'en_venta').reduce((a, s) => a + s.qty, 0);
  }
  const enBalance = $derived(data.inventory.find((i) => i.item_id === itemId)?.qty ?? 0);
  const disponible = $derived(Math.max(0, Math.floor(enBalance - pendienteDe(itemId))));
  // Al cambiar de item, precarga la cantidad con lo disponible (vender todo).
  $effect(() => {
    const _ = itemId;
    qty = disponible || null;
  });

  // Impuestos (solo los paga quien vende): 4% con Premium / 8% sin; orden de venta +2.5%.
  const TAX_RATE = $derived(data.premium ? 0.04 : 0.08);
  const bruto = $derived((qty ?? 0) * (priceUnit ?? 0));
  const impVenta = $derived(bruto * TAX_RATE);
  const feeOrden = $derived(orderType === 'sell_order' ? bruto * 0.025 : 0);
  const impuesto = $derived(impVenta + feeOrden);
  const neto = $derived(bruto - impuesto);

  let saving = $state(false);
  let error = $state('');
  let warn = $state('');
  let msg = $state('');
  let busyId = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    warn = '';
    msg = '';
    if (!data.group) return;
    if (!itemId || (qty ?? 0) <= 0 || (priceUnit ?? 0) <= 0) {
      error = 'Elige item, cantidad y precio.';
      return;
    }
    if ((qty ?? 0) > disponible) {
      error = `Solo tienes ${fmt(disponible)} disponibles (sin contar lo ya listado).`;
      return;
    }
    saving = true;
    try {
      const instant = orderType === 'instant';
      const { error: e1 } = await supabase.from('market_txns').insert({
        group_id: data.group.id,
        item_id: itemId,
        qty,
        price_unit: priceUnit,
        city: city.trim() || null,
        kind: 'sell',
        order_type: orderType,
        taxes: impuesto,
        status: instant ? 'vendido' : 'en_venta',
        resolved_at: instant ? new Date().toISOString() : null,
        fecha,
      });
      if (e1) throw e1;
      try {
        await recompute(data.group.id);
      } catch (re) {
        warn = emsg(re);
        saving = false;
        return;
      }
      msg = instant ? 'Venta registrada.' : 'Orden de venta creada (en venta).';
      priceUnit = null;
      await invalidateAll();
    } catch (err) {
      error = emsg(err);
    } finally {
      saving = false;
    }
  }

  // Cambiar el estado de una orden listada.
  async function cambiarEstado(s: SellRow, status: 'vendido' | 'cancelado') {
    if (!data.group) return;
    if (status === 'cancelado' && !confirm(`¿Quitar la orden de ${fmt(s.qty)} × ${s.name_es}? El impuesto pagado (${fmt(s.taxes)}) será pérdida.`)) return;
    busyId = s.id;
    error = '';
    msg = '';
    try {
      const { error: e1 } = await supabase
        .from('market_txns')
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', s.id);
      if (e1) throw e1;
      await recompute(data.group.id);
      msg = status === 'vendido' ? 'Marcada como vendida.' : 'Orden cancelada (impuesto a pérdidas).';
      await invalidateAll();
    } catch (err) {
      error = emsg(err);
    } finally {
      busyId = null;
    }
  }

  // Volver a listar lo cancelado: precarga el formulario con esos datos.
  function relistar(s: SellRow) {
    itemId = s.item_id;
    priceUnit = s.price_unit;
    city = s.city ?? 'Caerleon';
    orderType = 'sell_order';
    msg = 'Formulario precargado para volver a listar.';
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const pendientes = $derived(data.sells.filter((s) => s.status === 'en_venta'));
  const historial = $derived(data.sells.filter((s) => s.status !== 'en_venta'));
</script>

<section class="space-y-5">
  <div class="flex items-center gap-2 text-sm text-stone-400">
    <a href="{base}/registrar" class="hover:text-stone-200">Registrar</a> <span>/</span> <span class="text-stone-200">Vender</span>
  </div>
  <h1 class="text-2xl font-semibold">Vender en el mercado</h1>
  <p class="text-sm text-stone-400">Vende lo que produjiste. Una <strong>orden de venta</strong> queda listada hasta que alguien la compre; una <strong>venta instantánea</strong> se cierra al momento.</p>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else}
    {#if data.inventory.length === 0}
      <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">No tienes nada en inventario para vender todavía.</p>
    {:else}
      <form onsubmit={submit} class="space-y-4">
        <div class="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">¿Qué vendes? (de tu inventario)</span>
            <div class="flex items-center gap-2">
              <ItemImg {itemId} nombre={nombre(itemId)} size={26} />
              <select bind:value={itemId} class="flex-1 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
                {#each data.inventory as it}
                  <option value={it.item_id}>{it.name_es} · {fmt(it.qty)} disp.</option>
                {/each}
              </select>
            </div>
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="mb-1 block text-xs text-stone-400">Cantidad <span class="text-stone-600">({fmt(disponible)} disp.)</span></span>
              <input type="number" bind:value={qty} min="0" max={disponible} placeholder={fmt(disponible)} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 tabular-nums" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs text-stone-400">Precio por unidad</span>
              <input type="number" bind:value={priceUnit} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 tabular-nums" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs text-stone-400">Ciudad</span>
              <select bind:value={city} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
                {#each CIUDADES as c}<option value={c}>{c}</option>{/each}
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs text-stone-400">Tipo de venta</span>
              <select bind:value={orderType} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
                <option value="sell_order">Orden de venta</option>
                <option value="instant">Venta instantánea</option>
              </select>
            </label>
            <label class="col-span-2 block">
              <span class="mb-1 block text-xs text-stone-400">Fecha</span>
              <input type="date" bind:value={fecha} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
            </label>
          </div>
        </div>

        {#if bruto > 0}
          <div class="space-y-1 rounded-2xl border border-stone-800 bg-stone-900/50 p-4 text-sm">
            <div class="flex justify-between text-stone-400"><span>Bruto</span><span class="tabular-nums text-stone-200">{fmt(bruto)}</span></div>
            <div class="flex justify-between text-stone-400">
              <span>Impuesto de venta ({(TAX_RATE * 100).toFixed(0)}% {data.premium ? 'Premium' : 'sin Premium'})</span>
              <span class="tabular-nums text-red-300">−{fmt(impVenta)}</span>
            </div>
            {#if orderType === 'sell_order'}
              <div class="flex justify-between text-stone-400"><span>Tarifa de orden (2.5%)</span><span class="tabular-nums text-red-300">−{fmt(feeOrden)}</span></div>
            {/if}
            <div class="flex justify-between border-t border-stone-800 pt-1 font-medium"><span>Neto si se vende</span><span class="tabular-nums text-green-300">{fmt(neto)}</span></div>
          </div>
        {/if}

        {#if error}<p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>{/if}
        {#if warn}<p class="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Guardado, pero no se pudo recalcular: {warn}</p>{/if}
        {#if msg}<p class="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300">{msg}</p>{/if}

        <button type="submit" disabled={saving} class="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60">
          {saving ? 'Guardando…' : orderType === 'instant' ? 'Registrar venta' : 'Crear orden de venta'}
        </button>
      </form>
    {/if}

    <!-- Órdenes en venta (pendientes) -->
    {#if pendientes.length > 0}
      <div>
        <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">En venta (esperando comprador)</h2>
        <div class="space-y-2">
          {#each pendientes as s}
            <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/25 bg-stone-900/50 p-3">
              <ItemImg itemId={s.item_id} nombre={s.name_es} size={30} />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{fmt(s.qty)} × {s.name_es}</p>
                <p class="text-xs text-stone-500">a {fmt(s.price_unit)} c/u · {s.city ?? '—'} · {s.fecha} · impuesto {fmt(s.taxes)}</p>
              </div>
              <span class="rounded-full px-2.5 py-1 text-xs {ESTADO[s.status].clase}">{ESTADO[s.status].label}</span>
              <div class="flex gap-2">
                <button onclick={() => cambiarEstado(s, 'vendido')} disabled={busyId === s.id} class="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-200 hover:bg-green-500/30 disabled:opacity-50">✓ Se vendió</button>
                <button onclick={() => cambiarEstado(s, 'cancelado')} disabled={busyId === s.id} class="rounded-lg border border-stone-700 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 disabled:opacity-50">✕ Cancelar</button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Historial (vendidas / canceladas) -->
    {#if historial.length > 0}
      <div>
        <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Historial</h2>
        <div class="space-y-1.5">
          {#each historial as s}
            <div class="flex flex-wrap items-center gap-3 rounded-xl border border-stone-800 bg-stone-900/40 px-4 py-2.5 text-sm">
              <ItemImg itemId={s.item_id} nombre={s.name_es} size={24} />
              <span class="min-w-0 flex-1 truncate">{fmt(s.qty)} × {s.name_es} <span class="text-xs text-stone-500">· {s.fecha}</span></span>
              {#if s.status === 'vendido'}
                <span class="text-xs tabular-nums text-green-300">neto {fmt(s.qty * s.price_unit - s.taxes)}</span>
              {:else}
                <span class="text-xs tabular-nums text-red-300">pérdida {fmt(s.taxes)}</span>
                <button onclick={() => relistar(s)} class="rounded-lg border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-800">volver a listar</button>
              {/if}
              <span class="rounded-full px-2 py-0.5 text-xs {ESTADO[s.status].clase}">{ESTADO[s.status].label}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</section>
