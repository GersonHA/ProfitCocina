<script lang="ts">
  import ItemImg from '$lib/components/ItemImg.svelte';
  import MiniChart from '$lib/components/MiniChart.svelte';
  import PriceChart from '$lib/components/PriceChart.svelte';

  let { data } = $props();

  const ACCIONES = [
    { href: '/cadena', emoji: '🔗', label: 'Mi cadena', primary: true },
    { href: '/registrar/mercado', emoji: '🏪', label: 'Mercado' },
    { href: '/registrar/compra-miembro', emoji: '🤝', label: 'Comprar a un miembro' },
    { href: '/registrar/ajuste', emoji: '⚖️', label: 'Ajuste de stock' },
    { href: '/precios', emoji: '💲', label: 'Precios de mercado' },
  ];

  const CIUDADES = ['Caerleon', 'Martlock', 'Fort Sterling', 'Thetford', 'Lymhurst', 'Bridgewatch', 'Brecilien'];
  const CITY_COLORS: Record<string, string> = {
    Caerleon: '#eab308',
    Martlock: '#3b82f6',
    'Fort Sterling': '#e5e7eb',
    Lymhurst: '#22c55e',
    Bridgewatch: '#f97316',
    Thetford: '#a855f7',
    Brecilien: '#ec4899',
  };
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

  // --- Gráfico de precios (item + ciudad) ---
  function defItem(): string {
    return data.snaps[0]?.item_id ?? data.items[0]?.item_id ?? '';
  }
  let gItem = $state(defItem());
  let gCiudad = $state('Todas');

  const serie = $derived.by(() => {
    const dates = new Set<string>();
    const byCity = new Map<string, Map<string, { precio: number; volumen: number }>>();
    for (const s of data.snaps) {
      if (s.item_id !== gItem) continue;
      if (gCiudad !== 'Todas' && s.city !== gCiudad) continue;
      dates.add(s.fecha);
      let m = byCity.get(s.city);
      if (!m) {
        m = new Map();
        byCity.set(s.city, m);
      }
      m.set(s.fecha, { precio: Number(s.sell_order_min) || 0, volumen: Number(s.volume) || 0 });
    }
    const labels = [...dates].sort();
    const cities = CIUDADES.filter((c) => byCity.has(c)).map((c) => {
      const m = byCity.get(c)!;
      return {
        name: c,
        color: CITY_COLORS[c] ?? '#f59e0b',
        price: labels.map((f) => m.get(f)?.precio ?? null),
        volume: labels.map((f) => m.get(f)?.volumen ?? null),
      };
    });
    const totalVolume = labels.map((_, i) => cities.reduce((sum, c) => sum + (c.volume[i] ?? 0), 0));
    return { labels, cities, totalVolume };
  });

  // --- Doughnut de inventario ---
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
        <p class="mt-1 text-2xl font-semibold text-orange-300 tabular-nums">{sM(data.invested)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Ventas</p>
        <p class="mt-1 text-2xl font-semibold text-blue-300 tabular-nums">{sM(data.ventas)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Ganancia realizada</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums {data.ganancia >= 0 ? 'text-green-300' : 'text-red-300'}">{sM(data.ganancia)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Valor inventario</p>
        <p class="mt-1 text-2xl font-semibold text-amber-300 tabular-nums">{sM(data.invValue)}</p>
      </div>
    </div>

    <!-- Gráfico de precios de mercado -->
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <div class="mb-3 flex flex-wrap items-end gap-3">
        <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Precios de mercado</h2>
        <label class="ml-auto block">
          <span class="mb-1 block text-xs text-stone-400">Item</span>
          <select bind:value={gItem} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
            {#each data.items as it}<option value={it.item_id}>{it.name_es}</option>{/each}
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Ciudad</span>
          <select bind:value={gCiudad} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
            <option value="Todas">Todas</option>
            {#each CIUDADES as c}<option value={c}>{c}</option>{/each}
          </select>
        </label>
      </div>
      {#if serie.labels.length === 0}
        <p class="py-16 text-center text-sm text-stone-500">
          Sin precios para ese item. Regístralos en <a href="/precios" class="text-amber-300 underline">Precios de mercado</a>.
        </p>
      {:else}
        <PriceChart labels={serie.labels} cities={serie.cities} totalVolume={serie.totalVolume} />
      {/if}
    </div>

    <!-- Inventario + movimientos -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4 lg:col-span-1">
        <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Inventario por item</h2>
        {#if data.inventory.length > 0}
          <MiniChart config={inventoryConfig} height="h-64" />
        {:else}
          <p class="py-16 text-center text-sm text-stone-500">Sin inventario.</p>
        {/if}
      </div>

      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5 lg:col-span-2">
        <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">Últimos movimientos</h2>
        {#if data.movements.length === 0}
          <p class="py-8 text-center text-sm text-stone-500">Aún no hay movimientos.</p>
        {:else}
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
        {/if}
      </div>
    </div>
  {/if}
</section>
