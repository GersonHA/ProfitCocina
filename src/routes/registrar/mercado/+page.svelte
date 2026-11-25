<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { recompute } from '$lib/recompute';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  function hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function firstItem(): string {
    return data.items[0]?.item_id ?? '';
  }
  function nombre(id: string): string {
    return data.items.find((i) => i.item_id === id)?.name_es ?? id;
  }

  let direction = $state<'buy' | 'sell'>('sell');
  let itemId = $state(firstItem());
  let qty = $state<number | null>(null);
  let priceUnit = $state<number | null>(null);
  let city = $state('');
  let orderType = $state<'sell_order' | 'instant'>('sell_order');
  let fecha = $state(hoy());

  let saving = $state(false);
  let error = $state('');
  let warn = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    warn = '';
    if (!data.group) return;
    if (!itemId || (qty ?? 0) <= 0 || (priceUnit ?? 0) < 0) {
      error = 'Elige item, cantidad y precio.';
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
        kind: direction,
        order_type: direction === 'sell' ? orderType : null,
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
    <a href="/registrar" class="hover:text-stone-200">Registrar</a> <span>/</span> <span class="text-stone-200">Mercado</span>
  </div>
  <h1 class="text-2xl font-semibold">Mercado</h1>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else}
    <form onsubmit={submit} class="space-y-4">
      <div class="flex gap-2">
        <button
          type="button"
          onclick={() => (direction = 'sell')}
          class="flex-1 rounded-xl border px-4 py-2 font-medium transition {direction === 'sell'
            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
            : 'border-stone-700 text-stone-400 hover:bg-stone-800'}"
        >
          Vender
        </button>
        <button
          type="button"
          onclick={() => (direction = 'buy')}
          class="flex-1 rounded-xl border px-4 py-2 font-medium transition {direction === 'buy'
            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
            : 'border-stone-700 text-stone-400 hover:bg-stone-800'}"
        >
          Comprar
        </button>
      </div>

      <div class="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Item</span>
          <div class="flex items-center gap-2">
            <ItemImg {itemId} nombre={nombre(itemId)} size={26} />
            <select bind:value={itemId} class="flex-1 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
              {#each data.items as it}
                <option value={it.item_id}>{it.name_es}</option>
              {/each}
            </select>
          </div>
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Cantidad</span>
            <input type="number" bind:value={qty} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Precio por unidad</span>
            <input type="number" bind:value={priceUnit} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Ciudad (opcional)</span>
            <input type="text" bind:value={city} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Fecha</span>
            <input type="date" bind:value={fecha} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          {#if direction === 'sell'}
            <label class="col-span-2 block">
              <span class="mb-1 block text-xs text-stone-400">Tipo de venta</span>
              <select bind:value={orderType} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
                <option value="sell_order">Orden de venta</option>
                <option value="instant">Venta instantánea</option>
              </select>
            </label>
          {/if}
        </div>
      </div>

      {#if error}
        <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      {/if}
      {#if warn}
        <p class="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Guardado, pero no se pudo recalcular: {warn} <a href="/mi-produccion" class="underline">Ir a Mi producción</a>
        </p>
      {/if}

      <button type="submit" disabled={saving} class="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60">
        {saving ? 'Guardando…' : direction === 'sell' ? 'Registrar venta' : 'Registrar compra'}
      </button>
    </form>
  {/if}
</section>
