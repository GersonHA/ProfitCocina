<script lang="ts">
  import { base } from '$app/paths';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  const TIPO_MOV: Record<string, string> = {
    entrada_produccion: 'Producción',
    salida_produccion: 'Consumo',
    compra_miembro: 'Compra a miembro',
    venta_miembro: 'Venta a miembro',
    compra_mercado: 'Compra mercado',
    venta_mercado: 'Venta mercado',
    ajuste: 'Ajuste',
  };

  function nombre(id: string): string {
    return data.names[id] ?? id;
  }

  function silver(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return Math.round(Number(n)).toLocaleString('es-ES', { useGrouping: 'always' });
  }
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Mi producción</h1>
    <a href="{base}/cadena" class="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-stone-950 hover:bg-amber-400">
      + Registrar producción
    </a>
  </div>

  <!-- Inventario valorizado -->
  <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
    <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">Inventario (promedio ponderado)</h2>
    {#if data.balances.length === 0}
      <p class="text-stone-400">Todavía no tienes inventario. Registra un lote para empezar.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs text-stone-500">
            <tr>
              <th class="pb-2">Item</th>
              <th class="pb-2 text-right">Cantidad</th>
              <th class="pb-2 text-right">Costo prom.</th>
              <th class="pb-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-800">
            {#each data.balances as b}
              <tr>
                <td class="flex items-center gap-2 py-2.5">
                  <ItemImg itemId={b.item_id} nombre={nombre(b.item_id)} size={26} />
                  <span>{nombre(b.item_id)}</span>
                </td>
                <td class="py-2.5 text-right tabular-nums">{silver(b.qty)}</td>
                <td class="py-2.5 text-right tabular-nums text-stone-300">{silver(b.avg_cost)}</td>
                <td class="py-2.5 text-right tabular-nums text-amber-300">{silver(b.value)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Kardex: movimientos -->
  {#if data.movements.length > 0}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
      <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">Kardex (últimos movimientos)</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs text-stone-500">
            <tr>
              <th class="pb-2">Fecha</th>
              <th class="pb-2">Item</th>
              <th class="pb-2">Tipo</th>
              <th class="pb-2 text-right">Cant.</th>
              <th class="pb-2 text-right">Costo u.</th>
              <th class="pb-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-800">
            {#each data.movements as m}
              <tr>
                <td class="py-2 text-stone-400">{m.fecha}</td>
                <td class="py-2">{nombre(m.item_id)}</td>
                <td class="py-2 text-stone-400">{TIPO_MOV[m.type] ?? m.type}</td>
                <td class="py-2 text-right tabular-nums {m.qty < 0 ? 'text-red-300' : 'text-green-300'}">{silver(m.qty)}</td>
                <td class="py-2 text-right tabular-nums text-stone-400">{silver(m.unit_cost)}</td>
                <td class="py-2 text-right tabular-nums">{silver(m.bal_qty)} und a {silver(m.bal_avg_cost)} c/u</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- Lotes recientes -->
  {#if data.processes.length > 0}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
      <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">Lotes recientes</h2>
      <ul class="divide-y divide-stone-800">
        {#each data.processes as p}
          <li class="flex items-center justify-between py-2 text-sm">
            <span class="capitalize">{p.type}</span>
            <span class="text-stone-400">{p.fecha}{p.city ? ` · ${p.city}` : ''}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
