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
  function nombre(id: string): string {
    return data.items.find((i) => i.item_id === id)?.name_es ?? id;
  }
  function firstItem(): string {
    return data.items[0]?.item_id ?? '';
  }
  function firstSeller(): string {
    return data.members[0]?.id ?? '';
  }

  let sellerId = $state(firstSeller());
  let itemId = $state(firstItem());
  let qty = $state<number | null>(null);
  let priceUnit = $state<number | null>(null);
  let fecha = $state(hoy());
  let suggested = $state<number | null>(null);

  let saving = $state(false);
  let error = $state('');
  let warn = $state('');

  // Precio sugerido = costo promedio vigente del vendedor para ese item.
  $effect(() => {
    const sid = sellerId;
    const iid = itemId;
    if (!sid || !iid || !data.group) {
      suggested = null;
      return;
    }
    supabase
      .from('inventory_balances')
      .select('avg_cost')
      .eq('group_id', data.group.id)
      .eq('user_id', sid)
      .eq('item_id', iid)
      .maybeSingle()
      .then(({ data: b }) => {
        suggested = b ? Number(b.avg_cost) : null;
        // Se compran a costo: precarga el precio con el costo del vendedor.
        if (suggested !== null) priceUnit = Math.round(suggested * 100) / 100;
      });
  });

  function usarSugerido() {
    if (suggested !== null) priceUnit = Math.round(suggested * 100) / 100;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    warn = '';
    if (!data.group || !data.myId) return;
    if (!sellerId || !itemId || (qty ?? 0) <= 0 || (priceUnit ?? 0) < 0) {
      error = 'Elige vendedor, item, cantidad y precio.';
      return;
    }
    saving = true;
    try {
      const { error: e1 } = await supabase.from('member_trades').insert({
        group_id: data.group.id,
        seller_id: sellerId,
        buyer_id: data.myId,
        item_id: itemId,
        qty,
        price_unit: priceUnit,
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
    <a href="/registrar" class="hover:text-stone-200">Registrar</a> <span>/</span> <span class="text-stone-200">Comprar a un miembro</span>
  </div>
  <h1 class="text-2xl font-semibold">Comprar a un miembro</h1>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else if data.members.length === 0}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">
      No hay otros miembros en tu grupo todavía.
    </p>
  {:else}
    <form onsubmit={submit} class="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Vendedor</span>
        <select bind:value={sellerId} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
          {#each data.members as m}
            <option value={m.id}>{m.nick}</option>
          {/each}
        </select>
      </label>

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
      </div>

      <div class="flex items-center justify-between rounded-lg bg-stone-800/40 px-3 py-2 text-sm">
        <span class="text-stone-400">
          Precio a costo del vendedor (ya precargado):
          <span class="text-stone-200">{suggested === null ? '— (sin stock registrado)' : Math.round(suggested).toLocaleString('es-ES')}</span>
        </span>
        {#if suggested !== null}
          <button type="button" onclick={usarSugerido} class="rounded-lg border border-stone-700 px-2 py-1 text-xs hover:bg-stone-800">Usar</button>
        {/if}
      </div>

      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Fecha</span>
        <input type="date" bind:value={fecha} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>

      {#if error}
        <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      {/if}
      {#if warn}
        <p class="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Guardado, pero no se pudo recalcular: {warn} <a href="/mi-produccion" class="underline">Ir a Mi producción</a>
        </p>
      {/if}

      <button type="submit" disabled={saving} class="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60">
        {saving ? 'Guardando…' : 'Registrar compra'}
      </button>
    </form>
  {/if}
</section>
