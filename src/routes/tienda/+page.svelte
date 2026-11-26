<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  let creando = $state(false);
  let errorOrden = $state('');
  async function crearOrden() {
    if (!recipe || !data.groupId) return;
    creando = true;
    errorOrden = '';
    try {
      const { data: ord, error } = await supabase
        .from('production_orders')
        .insert({ group_id: data.groupId, output_item: recipe.outputItem, tandas, state: 'compras' })
        .select('id')
        .single();
      if (error) throw error;
      const items = filas.map((f) => ({
        order_id: ord.id,
        item_id: f.itemId,
        qty: f.cant,
        source: f.externo ? 'external' : 'member',
        seller_id: f.externo ? null : (f.productor?.id ?? null),
        unit_price: f.precio,
      }));
      const { error: e2 } = await supabase.from('order_items').insert(items);
      if (e2) throw e2;
      await goto(`/ordenes/${ord.id}`);
    } catch (err) {
      errorOrden = err instanceof Error ? err.message : String(err);
      creando = false;
    }
  }

  function plano(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return Math.round(Number(n)).toLocaleString('es-ES', { useGrouping: 'always' });
  }
  function nombre(id: string): string {
    return data.names[id] ?? id;
  }
  // Todos los miembros que producen un item (puede ser más de uno).
  function productoresDe(itemId: string) {
    return data.members.filter((m) => m.produceItem === itemId);
  }
  // Vendedor elegido por ingrediente (por defecto, el más barato).
  let selProd = $state<Record<string, string>>({});
  function productorSel(itemId: string) {
    const prods = productoresDe(itemId);
    if (prods.length === 0) return null;
    return prods.find((p) => p.id === selProd[itemId]) ?? prods[0];
  }

  // --- Selección de platillo + calidad (encantamiento) ---
  function defBase(): string {
    return data.recipes.find((r) => r.baseId === 'T8_MEAL_STEW')?.baseId ?? data.recipes[0]?.baseId ?? '';
  }
  let baseId = $state(defBase());
  let enchant = $state(0);
  let tandas = $state(1);

  const baseMeals = $derived.by(() => {
    const seen = new Set<string>();
    const out: { baseId: string; nombre: string; tier: number }[] = [];
    for (const r of data.recipes) {
      if (!seen.has(r.baseId)) {
        seen.add(r.baseId);
        out.push({ baseId: r.baseId, nombre: nombre(r.baseId), tier: r.tier });
      }
    }
    return out.sort((a, b) => a.tier - b.tier || a.nombre.localeCompare(b.nombre));
  });
  const niveles = $derived(
    data.recipes.filter((r) => r.baseId === baseId).map((r) => r.enchant).sort((a, b) => a - b),
  );
  $effect(() => {
    if (!niveles.includes(enchant)) enchant = 0;
  });
  const recipe = $derived(
    data.recipes.find((r) => r.baseId === baseId && r.enchant === enchant) ??
      data.recipes.find((r) => r.baseId === baseId) ??
      null,
  );

  // Precio de los ingredientes externos (los que nadie del grupo produce).
  // Se precargan con el último precio de mercado y el usuario puede ajustarlos.
  let extPrices = $state<Record<string, number | null>>({});
  $effect(() => {
    const rec = recipe;
    if (!rec) return;
    let changed = false;
    const next = { ...extPrices };
    for (const ing of rec.ingredients) {
      if (productoresDe(ing.itemId).length === 0 && !(ing.itemId in next)) {
        next[ing.itemId] = data.marketPrice[ing.itemId] ?? null;
        changed = true;
      }
    }
    if (changed) extPrices = next;
  });

  // Por defecto, elige al productor más barato de cada ingrediente.
  $effect(() => {
    const rec = recipe;
    if (!rec) return;
    let changed = false;
    const next = { ...selProd };
    for (const ing of rec.ingredients) {
      const prods = productoresDe(ing.itemId);
      if (prods.length && !(ing.itemId in next)) {
        const barato = [...prods].sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity))[0];
        next[ing.itemId] = barato.id;
        changed = true;
      }
    }
    if (changed) selProd = next;
  });

  function precioDe(itemId: string): number | null {
    const prod = productorSel(itemId);
    if (prod) return prod.cost;
    return extPrices[itemId] ?? null;
  }

  const filas = $derived.by(() => {
    if (!recipe) return [];
    return recipe.ingredients.map((ing) => {
      const prods = productoresDe(ing.itemId);
      const prod = productorSel(ing.itemId);
      const precio = precioDe(ing.itemId);
      const cant = ing.qty * tandas;
      return {
        itemId: ing.itemId,
        nombre: nombre(ing.itemId),
        cant,
        productor: prod,
        productores: prods,
        mio: prod?.id === data.meId,
        externo: prods.length === 0,
        precio,
        linea: precio != null ? precio * cant : null,
      };
    });
  });

  const completo = $derived(filas.length > 0 && filas.every((f) => f.precio != null));
  const costoTotal = $derived(filas.reduce((s, f) => s + (f.linea ?? 0), 0));
  const platillos = $derived((recipe?.outputQty ?? 0) * tandas);
  const costoPorPlatillo = $derived(platillos > 0 ? costoTotal / platillos : 0);
  const precioMercado = $derived(recipe ? (data.marketPrice[recipe.outputItem] ?? null) : null);
  const gananciaPorPlatillo = $derived(precioMercado != null ? precioMercado - costoPorPlatillo : null);
</script>

<section class="space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">Mercado del grupo</h1>
    <p class="mt-1 text-sm text-stone-400">
      El precio de cada miembro es su costo de producción (sin ganancia). Los ingredientes que el grupo no produce se completan con su precio de mercado. La ganancia se obtiene al vender el platillo terminado.
    </p>
  </div>

  {#if data.members.length === 0}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No hay un grupo activo.</p>
  {:else}
    <!-- Precios de los miembros -->
    <div>
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Precio de cada miembro (a costo)</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.members as m}
          <div class="rounded-2xl border {m.id === data.meId ? 'border-amber-500/40' : 'border-stone-800'} bg-stone-900/50 p-4">
            <div class="flex items-center gap-3">
              <div class="grid size-12 place-items-center rounded-xl bg-stone-950">
                <ItemImg itemId={m.produceItem} nombre={m.produceName} size={34} />
              </div>
              <div class="min-w-0">
                <p class="truncate font-medium">{m.nick}{#if m.id === data.meId}<span class="ml-1 text-xs text-amber-300">(tú)</span>{/if}</p>
                <p class="truncate text-xs text-stone-500">produce {m.produceName || '—'}</p>
              </div>
              <div class="ml-auto text-right">
                <p class="text-xs text-stone-500">Costo/u</p>
                <p class="text-lg font-semibold text-amber-300 tabular-nums">{plano(m.cost)}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Calculadora -->
    {#if recipe}
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div class="flex items-center gap-3">
            <ItemImg itemId={recipe.outputItem} nombre={nombre(recipe.baseId)} size={38} />
            <div class="flex flex-wrap items-end gap-3">
              <label class="block">
                <span class="mb-1 block text-xs text-stone-400">Platillo</span>
                <select bind:value={baseId} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
                  {#each baseMeals as b}
                    <option value={b.baseId}>T{b.tier} · {b.nombre}</option>
                  {/each}
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-xs text-stone-400">Calidad</span>
                <div class="flex rounded-lg border border-stone-700 p-0.5 text-sm">
                  {#each niveles as n}
                    <button
                      onclick={() => (enchant = n)}
                      class="rounded px-2.5 py-1 {enchant === n ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-100'}"
                    >
                      {n === 0 ? 'Normal' : `${recipe.tier}.${n}`}
                    </button>
                  {/each}
                </div>
              </label>
            </div>
          </div>
          <div class="flex items-end gap-3">
            <p class="text-xs text-stone-500">
              Da {recipe.outputQty} por tanda
              <span class="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">{recipe.station}</span>
            </p>
            <label class="block">
              <span class="mb-1 block text-xs text-stone-400">Tandas</span>
              <input type="number" bind:value={tandas} min="1" class="w-20 rounded-lg border border-stone-700 bg-stone-950 px-3 py-1.5 tabular-nums" />
            </label>
          </div>
        </div>

        <!-- Ingredientes -->
        <div class="divide-y divide-stone-800">
          {#each filas as f}
            <div class="flex items-center gap-3 py-2.5">
              <ItemImg itemId={f.itemId} nombre={f.nombre} size={30} />
              <div class="min-w-0 flex-1">
                <p class="text-sm"><span class="tabular-nums text-stone-400">{plano(f.cant)}×</span> {f.nombre}</p>
                {#if f.externo}
                  <p class="text-xs text-stone-500"><span class="text-sky-300">compra externa</span> (nadie del grupo lo produce)</p>
                {:else if f.productores.length > 1}
                  <div class="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                    <span>compras a</span>
                    <select bind:value={selProd[f.itemId]} class="rounded border border-stone-700 bg-stone-950 px-1.5 py-0.5 text-xs text-stone-200">
                      {#each [...f.productores].sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity)) as p, i}
                        <option value={p.id}>{p.id === data.meId ? 'tú' : p.nick} · {plano(p.cost)} c/u{i === 0 ? ' (más barato)' : ''}</option>
                      {/each}
                    </select>
                  </div>
                {:else if f.mio}
                  <p class="text-xs text-stone-500">lo produces tú · {plano(f.precio)} c/u</p>
                {:else}
                  <p class="text-xs text-stone-500">compras a {f.productor?.nick} · {plano(f.precio)} c/u</p>
                {/if}
              </div>
              {#if f.externo}
                <label class="flex items-center gap-1 text-xs text-stone-500">
                  precio
                  <input
                    type="number"
                    bind:value={extPrices[f.itemId]}
                    min="0"
                    placeholder="c/u"
                    class="w-24 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1 text-right text-sm tabular-nums text-stone-200"
                  />
                </label>
              {/if}
              <p class="w-24 text-right text-sm tabular-nums {f.externo ? 'text-sky-200' : f.mio ? 'text-stone-300' : 'text-amber-200'}">
                {f.linea != null ? plano(f.linea) : '—'}
              </p>
            </div>
          {/each}
        </div>

        <!-- Resumen -->
        <div class="mt-4 space-y-1.5 rounded-xl bg-stone-950/60 p-4 text-sm">
          <div class="flex justify-between">
            <span class="text-stone-400">Costo total ({plano(platillos)} und)</span>
            <span class="font-semibold tabular-nums">{completo ? plano(costoTotal) : '— faltan precios'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-stone-400">Costo por platillo</span>
            <span class="font-semibold tabular-nums text-amber-300">{completo ? plano(costoPorPlatillo) : '—'}</span>
          </div>
          <div class="flex justify-between border-t border-stone-800 pt-1.5">
            <span class="text-stone-400">Precio de mercado del platillo</span>
            <span class="tabular-nums text-stone-300">{precioMercado != null ? plano(precioMercado) : 'sin dato'}</span>
          </div>
          {#if completo && gananciaPorPlatillo != null}
            <div class="flex justify-between">
              <span class="text-stone-400">Ganancia por platillo (antes de impuesto)</span>
              <span class="font-semibold tabular-nums {gananciaPorPlatillo >= 0 ? 'text-green-300' : 'text-red-300'}">
                {gananciaPorPlatillo >= 0 ? '+' : ''}{plano(gananciaPorPlatillo)}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-stone-400">Ganancia total estimada</span>
              <span class="font-semibold tabular-nums {gananciaPorPlatillo >= 0 ? 'text-green-300' : 'text-red-300'}">
                {gananciaPorPlatillo >= 0 ? '+' : ''}{plano(gananciaPorPlatillo * platillos)}
              </span>
            </div>
          {/if}
        </div>

        {#if filas.some((f) => f.externo)}
          <p class="mt-2 text-xs text-stone-500">
            Los ingredientes de <span class="text-sky-300">compra externa</span> se registran al comprarlos en <a href="/registrar/mercado" class="text-amber-300 underline">Mercado</a>; su costo entra al inventario y se consume al cocinar.
          </p>
        {/if}
        {#if precioMercado == null}
          <p class="mt-1 text-xs text-stone-500">
            Registra el precio de este platillo en <a href="/precios" class="text-amber-300 underline">Precios de mercado</a> para ver la ganancia.
          </p>
        {/if}

        <div class="mt-4 flex flex-col items-end gap-1.5 border-t border-stone-800 pt-4">
          {#if errorOrden}<p class="text-xs text-red-300">{errorOrden}</p>{/if}
          <button
            onclick={crearOrden}
            disabled={creando || !completo}
            class="rounded-xl bg-amber-500 px-4 py-2.5 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creando ? 'Creando…' : '📋 Crear orden de producción'}
          </button>
          <p class="text-xs text-stone-500">
            {completo ? 'Convierte este plan en una orden con seguimiento (compras → cocina).' : 'Completa los precios para crear la orden.'}
          </p>
        </div>
      </div>
    {/if}
  {/if}
</section>
