<script lang="ts">
  import ItemImg from '$lib/components/ItemImg.svelte';
  import MiniChart from '$lib/components/MiniChart.svelte';

  let { data } = $props();

  const ACCIONES = [
    { href: '/cadena', emoji: '🔗', label: 'Mi cadena', primary: true },
    { href: '/registrar/mercado', emoji: '🏪', label: 'Mercado' },
    { href: '/registrar/compra-miembro', emoji: '🤝', label: 'Comprar a un miembro' },
    { href: '/registrar/ajuste', emoji: '⚖️', label: 'Ajuste de stock' },
    { href: '/precios', emoji: '💲', label: 'Precios de mercado' },
    { href: '/registrar/lote', emoji: '🌾', label: 'Lote (avanzado)' },
  ];

  const PALETTE = ['#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#a855f7', '#f97316', '#14b8a6', '#eab308', '#ef4444', '#6366f1'];

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
  function plano(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return Math.round(Number(n)).toLocaleString('es-ES');
  }
  function sM(n: number): string {
    const v = Math.round(n);
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + ' M';
    if (a >= 1e3) return (v / 1e3).toFixed(1).replace('.', ',') + ' k';
    return v.toLocaleString('es-ES');
  }

  const hayDatos = $derived(data.invValue > 0 || data.movements.length > 0 || data.invested > 0);

  const inventoryConfig = $derived({
    type: 'doughnut',
    data: {
      labels: data.inventory.map((i) => nombre(i.item_id)),
      datasets: [
        {
          data: data.inventory.map((i) => i.value),
          backgroundColor: data.inventory.map((_, idx) => PALETTE[idx % PALETTE.length]),
          borderColor: '#0c0a09',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#d6d3d1', boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx: { label?: string; parsed: number }) => `${ctx.label}: ${plano(ctx.parsed)}` } },
      },
    },
  });

  const financeConfig = $derived({
    type: 'bar',
    data: {
      labels: ['Invertido', 'Ventas', 'Ganancia'],
      datasets: [
        {
          data: [data.invested, data.ventas, data.ganancia],
          backgroundColor: ['#f97316', '#3b82f6', data.ganancia >= 0 ? '#22c55e' : '#ef4444'],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => plano(ctx.parsed.y) } },
      },
      scales: {
        y: { ticks: { color: '#a8a29e' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        x: { ticks: { color: '#d6d3d1' }, grid: { display: false } },
      },
    },
  });
</script>

<section class="space-y-6">
  <!-- Saludo + acciones -->
  <div>
    <p class="text-sm text-stone-400">Hola, {data.nick ?? 'cocinero'} 👋</p>
    <h1 class="text-2xl font-semibold">Panel</h1>
  </div>

  <div class="flex flex-wrap gap-2">
    {#each ACCIONES as a}
      <a
        href={a.href}
        class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition {a.primary
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
          : 'border-stone-700 text-stone-300 hover:bg-stone-800'}"
      >
        <span>{a.emoji}</span>{a.label}
      </a>
    {/each}
  </div>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else}
    <!-- KPIs -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Invertido</p>
        <p class="mt-1 text-xl font-semibold text-orange-300 tabular-nums">{sM(data.invested)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Ventas</p>
        <p class="mt-1 text-xl font-semibold text-blue-300 tabular-nums">{sM(data.ventas)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Ganancia realizada</p>
        <p class="mt-1 text-xl font-semibold tabular-nums {data.ganancia >= 0 ? 'text-green-300' : 'text-red-300'}">{sM(data.ganancia)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Valor inventario</p>
        <p class="mt-1 text-xl font-semibold text-amber-300 tabular-nums">{sM(data.invValue)}</p>
      </div>
    </div>

    {#if !hayDatos}
      <p class="rounded-2xl border border-stone-800 bg-stone-900/50 p-6 text-center text-sm text-stone-400">
        Todavía no hay datos. Empieza registrando en <a href="/cadena" class="text-amber-300 underline">Mi cadena</a>.
      </p>
    {:else}
      <!-- Gráficos -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
          <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Resumen financiero</h2>
          <MiniChart config={financeConfig} height="h-64" />
        </div>
        <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
          <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Inventario por item</h2>
          {#if data.inventory.length > 0}
            <MiniChart config={inventoryConfig} height="h-64" />
          {:else}
            <p class="py-16 text-center text-sm text-stone-500">Sin inventario.</p>
          {/if}
        </div>
      </div>

      <!-- Últimos movimientos -->
      {#if data.movements.length > 0}
        <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
          <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">Últimos movimientos</h2>
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
                    <td class="py-2">
                      <span class="flex items-center gap-2">
                        <ItemImg itemId={m.item_id} nombre={nombre(m.item_id)} size={20} />
                        {nombre(m.item_id)}
                      </span>
                    </td>
                    <td class="py-2 text-stone-400">{TIPO_MOV[m.type] ?? m.type}</td>
                    <td class="py-2 text-right tabular-nums {m.qty < 0 ? 'text-red-300' : 'text-green-300'}">{plano(m.qty)}</td>
                    <td class="py-2 text-right tabular-nums text-stone-400">{plano(m.unit_cost)}</td>
                    <td class="py-2 text-right tabular-nums">{plano(m.bal_qty)} und a {plano(m.bal_avg_cost)} c/u</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</section>
