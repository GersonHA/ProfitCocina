<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { recompute } from '$lib/recompute';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  const CIUDADES = ['Caerleon', 'Martlock', 'Fort Sterling', 'Thetford', 'Lymhurst', 'Bridgewatch', 'Brecilien'];

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

  let itemId = $state(firstItem());
  let qty = $state<number | null>(null);
  let priceUnit = $state<number | null>(null);
  let city = $state('Caerleon');
  let orderType = $state<'sell_order' | 'instant'>('sell_order');
  let fecha = $state(hoy());

  const disponible = $derived(data.inventory.find((i) => i.item_id === itemId)?.qty ?? 0);
  // Al cambiar de item, precarga la cantidad con lo disponible (vender todo).
  $effect(() => {
    const _ = itemId;
    qty = Math.floor(disponible) || null;
  });

  // Impuestos (solo los paga quien vende): 4% con Premium / 8% sin; orden de venta +2.5%.
  const TAX_RATE = $derived(data.premium ? 0.04 : 0.08);
  const bruto = $derived((qty ?? 0) * (priceUnit ?? 0));
  const impVenta = $derived(bruto * TAX_RATE);
  const feeOrden = $derived(orderType === 'sell_order' ? bruto * 0.025 : 0);
  const impuesto = $derived(impVenta + feeOrden);
  const neto = $derived(bruto - impuesto);
  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });

  let saving = $state(false);
  let error = $state('');
  let warn = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    warn = '';
    if (!data.group) return;
    if (!itemId || (qty ?? 0) <= 0 || (priceUnit ?? 0) <= 0) {
      error = 'Elige item, cantidad y precio.';
      return;
    }
    if ((qty ?? 0) > disponible) {
      error = `Solo tienes ${fmt(disponible)} disponibles.`;
      return;
    }
    saving = true;
    try {
      const { error: e1 } = await supabase.from('market_txns').insert({
        group_id: data.group.id,
        item_id: itemId,
        qty,
        price_unit: priceUnit,
        city: city.trim() || null,
        kind: 'sell',
        order_type: orderType,
        taxes: impuesto,
        fecha,
      });
      if (e1) throw e1;
      try {
        await recompute(data.group.id);
      } catch (re) {
        warn = re instanceof Error ? re.message : String(re);
        saving = false;
        return;
      }
      await goto('/mi-produccion');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      saving = false;
    }
  }
</script>

<section class="space-y-5">
  <div class="flex items-center gap-2 text-sm text-stone-400">
    <a href="/registrar" class="hover:text-stone-200">Registrar</a> <span>/</span> <span class="text-stone-200">Vender</span>
  </div>
  <h1 class="text-2xl font-semibold">Vender en el mercado</h1>
  <p class="text-sm text-stone-400">Vende lo que produjiste. Se descuenta de tu inventario y se registra la venta (con impuesto).</p>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else if data.inventory.length === 0}
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
          <div class="flex justify-between border-t border-stone-800 pt-1 font-medium"><span>Neto que recibes</span><span class="tabular-nums text-green-300">{fmt(neto)}</span></div>
        </div>
      {/if}

      {#if error}<p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>{/if}
      {#if warn}
        <p class="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Guardado, pero no se pudo recalcular: {warn} <a href="/mi-produccion" class="underline">Ir a Mi producción</a>
        </p>
      {/if}

      <button type="submit" disabled={saving} class="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60">
        {saving ? 'Guardando…' : 'Registrar venta'}
      </button>
    </form>
  {/if}
</section>
