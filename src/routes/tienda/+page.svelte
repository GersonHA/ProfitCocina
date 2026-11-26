<script lang="ts">
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  function plano(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return Math.round(Number(n)).toLocaleString('es-ES');
  }
  function nombre(id: string): string {
    return data.names[id] ?? id;
  }

  // Cuánto de cada ingrediente pide la receta (por tanda).
  const qtyPorTanda = $derived.by(() => {
    const m = new Map<string, number>();
    for (const ing of data.recipe?.ingredients ?? []) m.set(ing.itemId, ing.qty);
    return m;
  });

  // Quién produce cada item (para saber a quién se le compra y a qué costo).
  function productorDe(itemId: string) {
    return data.members.find((m) => m.produceItem === itemId) ?? null;
  }

  const yo = $derived(data.members.find((m) => m.id === data.meId) ?? null);

  // --- Calculadora ---
  let tandas = $state(1);

  const filas = $derived.by(() => {
    const rec = data.recipe;
    if (!rec) return [];
    return rec.ingredients.map((ing) => {
      const prod = productorDe(ing.itemId);
      const costoUnit = prod?.cost ?? null;
      const cant = ing.qty * tandas;
      const mio = prod?.id === data.meId;
      return {
        itemId: ing.itemId,
        nombre: nombre(ing.itemId),
        cant,
        productor: prod,
        mio,
        costoUnit,
        costoLinea: costoUnit != null ? costoUnit * cant : null,
      };
    });
  });

  const completo = $derived(filas.length > 0 && filas.every((f) => f.costoUnit != null));
  const costoTotal = $derived(filas.reduce((s, f) => s + (f.costoLinea ?? 0), 0));
  const guisos = $derived((data.recipe?.outputQty ?? 0) * tandas);
  const costoPorGuiso = $derived(guisos > 0 ? costoTotal / guisos : 0);
  const gananciaPorGuiso = $derived(data.guisoPrice != null ? data.guisoPrice - costoPorGuiso : null);
</script>

<section class="space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">Mercado del grupo</h1>
    <p class="mt-1 text-sm text-stone-400">
      Se venden entre ustedes a <span class="text-stone-200">precio de costo</span> (lo que cuesta producir, sin ganancia).
      La ganancia está en el <span class="text-amber-300">guiso final</span> que cada quien vende por su cuenta.
    </p>
  </div>

  {#if !data.group && data.members.length === 0}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else}
    <!-- Ofertas de los miembros -->
    <div>
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Precio de cada miembro (a costo)</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.members as m}
          {@const qPorTanda = qtyPorTanda.get(m.produceItem) ?? 0}
          <div class="rounded-2xl border {m.id === data.meId ? 'border-amber-500/40' : 'border-stone-800'} bg-stone-900/50 p-4">
            <div class="flex items-center gap-3">
              <div class="grid size-12 place-items-center rounded-xl bg-stone-950">
                <ItemImg itemId={m.produceItem} nombre={m.produceName} size={34} />
              </div>
              <div class="min-w-0">
                <p class="truncate font-medium">{m.nick}{#if m.id === data.meId}<span class="ml-1 text-xs text-amber-300">(tú)</span>{/if}</p>
                <p class="truncate text-xs text-stone-500">produce {m.produceName}</p>
              </div>
            </div>
            <div class="mt-3 flex items-end justify-between">
              <div>
                <p class="text-xs text-stone-500">Costo por unidad</p>
                <p class="text-xl font-semibold text-amber-300 tabular-nums">{plano(m.cost)}</p>
              </div>
              {#if qPorTanda > 0 && m.cost != null}
                <div class="text-right">
                  <p class="text-xs text-stone-500">Lote de 1 tanda ({qPorTanda}×)</p>
                  <p class="text-sm tabular-nums text-stone-300">{plano(m.cost * qPorTanda)}</p>
                </div>
              {/if}
            </div>
            {#if m.cost == null}
              <p class="mt-2 text-xs text-stone-500">Aún sin costo: necesita registrar su producción.</p>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Calculadora de receta -->
    {#if data.recipe}
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <ItemImg itemId={data.recipe.outputItem} nombre={nombre(data.recipe.outputItem)} size={28} />
            <div>
              <h2 class="font-medium">{nombre(data.recipe.outputItem)}</h2>
              <p class="text-xs text-stone-500">
                Da {data.recipe.outputQty} por fabricación
                <span class="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">{data.recipe.station}</span>
              </p>
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <span class="text-stone-400">Tandas</span>
            <input
              type="number"
              bind:value={tandas}
              min="1"
              class="w-20 rounded-lg border border-stone-700 bg-stone-950 px-3 py-1.5 tabular-nums"
            />
          </label>
        </div>

        <!-- Ingredientes -->
        <div class="divide-y divide-stone-800">
          {#each filas as f}
            <div class="flex items-center gap-3 py-2.5">
              <ItemImg itemId={f.itemId} nombre={f.nombre} size={30} />
              <div class="min-w-0 flex-1">
                <p class="text-sm"><span class="tabular-nums text-stone-400">{plano(f.cant)}×</span> {f.nombre}</p>
                <p class="text-xs text-stone-500">
                  {#if f.productor}
                    {f.mio ? 'lo produces tú' : `compras a ${f.productor.nick}`}
                    {#if f.costoUnit != null}· {plano(f.costoUnit)} c/u{/if}
                  {:else}
                    nadie del grupo lo produce aún
                  {/if}
                </p>
              </div>
              <p class="text-right text-sm tabular-nums {f.mio ? 'text-stone-300' : 'text-amber-200'}">
                {f.costoLinea != null ? plano(f.costoLinea) : '—'}
              </p>
            </div>
          {/each}
        </div>

        <!-- Resumen -->
        <div class="mt-4 space-y-1.5 rounded-xl bg-stone-950/60 p-4 text-sm">
          <div class="flex justify-between">
            <span class="text-stone-400">Costo total ({plano(guisos)} guisos)</span>
            <span class="font-semibold tabular-nums">{completo ? plano(costoTotal) : '— faltan costos'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-stone-400">Te sale cada guiso a</span>
            <span class="font-semibold tabular-nums text-amber-300">{completo ? plano(costoPorGuiso) : '—'}</span>
          </div>
          <div class="flex justify-between border-t border-stone-800 pt-1.5">
            <span class="text-stone-400">Precio de mercado del guiso</span>
            <span class="tabular-nums text-stone-300">{data.guisoPrice != null ? plano(data.guisoPrice) : 'sin dato'}</span>
          </div>
          {#if completo && gananciaPorGuiso != null}
            <div class="flex justify-between">
              <span class="text-stone-400">Ganancia por guiso (antes de impuesto)</span>
              <span class="font-semibold tabular-nums {gananciaPorGuiso >= 0 ? 'text-green-300' : 'text-red-300'}">
                {gananciaPorGuiso >= 0 ? '+' : ''}{plano(gananciaPorGuiso)}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-stone-400">Ganancia total estimada ({plano(guisos)} guisos)</span>
              <span class="font-semibold tabular-nums {gananciaPorGuiso >= 0 ? 'text-green-300' : 'text-red-300'}">
                {gananciaPorGuiso >= 0 ? '+' : ''}{plano(gananciaPorGuiso * guisos)}
              </span>
            </div>
          {/if}
        </div>

        {#if data.guisoPrice == null}
          <p class="mt-2 text-xs text-stone-500">
            Registra el precio del guiso en <a href="/precios" class="text-amber-300 underline">Precios de mercado</a> para ver tu ganancia.
          </p>
        {/if}
        <p class="mt-2 text-center text-xs text-stone-600">
          Aquí está el punto: comprar a costo baja lo que te sale el guiso; tu ganancia aparece al venderlo en el mercado.
        </p>
      </div>
    {/if}
  {/if}
</section>
