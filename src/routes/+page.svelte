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

  // --- Ganancia por período (gráfico de barras) ---
  let granularidad = $state<'dia' | 'mes'>('dia');
  const gananciaData = $derived.by(() => {
    if (granularidad === 'mes') {
      const byMonth = new Map<string, number>();
      for (const p of data.profitByDay) {
        const k = p.fecha.slice(0, 7);
        byMonth.set(k, (byMonth.get(k) ?? 0) + p.profit);
      }
      const labels = [...byMonth.keys()].sort();
      return { labels, values: labels.map((l) => byMonth.get(l)!) };
    }
    return { labels: data.profitByDay.map((p) => p.fecha), values: data.profitByDay.map((p) => p.profit) };
  });
  const gananciaConfig = $derived({
    type: 'bar',
    data: {
      labels: gananciaData.labels,
      datasets: [
        {
          label: 'Ganancia',
          data: gananciaData.values,
          backgroundColor: gananciaData.values.map((v) => (v >= 0 ? '#22c55e' : '#ef4444')),
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => plano(ctx.parsed.y) } } },
      scales: {
        y: { ticks: { color: '#a8a29e' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        x: { ticks: { color: '#d6d3d1' }, grid: { display: false } },
      },
    },
  });

  // --- Meta ---
  // Progreso de la meta (se configura en el Perfil; aquí solo se muestra).
  function fechaKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const logrado = $derived.by(() => {
    const period = data.metaPeriod;
    const today = fechaKey(new Date());
    if (period === 'day') return data.profitByDay.find((p) => p.fecha === today)?.profit ?? 0;
    if (period === 'week') {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const startK = fechaKey(start);
      return data.profitByDay.filter((p) => p.fecha >= startK && p.fecha <= today).reduce((s, p) => s + p.profit, 0);
    }
    const mk = today.slice(0, 7);
    return data.profitByDay.filter((p) => p.fecha.slice(0, 7) === mk).reduce((s, p) => s + p.profit, 0);
  });
  const metaPct = $derived(data.metaAmount && data.metaAmount > 0 ? logrado / data.metaAmount : 0);
  const roi = $derived(data.invested > 0 ? data.ganancia / data.invested : 0);
  const META_LABEL: Record<string, string> = { day: 'hoy', week: 'esta semana', month: 'este mes' };

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
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Invertido</p>
        <p class="mt-1 text-2xl font-semibold text-orange-300 tabular-nums">{sM(data.invested)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Ventas (neto)</p>
        <p class="mt-1 text-2xl font-semibold text-blue-300 tabular-nums">{sM(data.ventas)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Ganancia realizada</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums {data.ganancia >= 0 ? 'text-green-300' : 'text-red-300'}">{sM(data.ganancia)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">ROI realizado</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums {roi >= 0 ? 'text-green-300' : 'text-red-300'}">{(roi * 100).toFixed(0)}%</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Valor inventario</p>
        <p class="mt-1 text-2xl font-semibold text-amber-300 tabular-nums">{sM(data.invValue)}</p>
      </div>
      <a href="/perfil" class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4 transition hover:border-amber-500/40">
        <p class="text-xs text-stone-500">Meta de ganancia</p>
        {#if data.metaAmount && data.metaAmount > 0}
          <p class="mt-1 text-2xl font-semibold tabular-nums {logrado >= data.metaAmount ? 'text-green-300' : 'text-amber-300'}">{(metaPct * 100).toFixed(0)}%</p>
          <p class="text-[11px] text-stone-500">{sM(logrado)} de {sM(data.metaAmount)} · {META_LABEL[data.metaPeriod]}</p>
        {:else}
          <p class="mt-1 text-sm text-stone-400">Sin meta — <span class="text-amber-300">ponla en tu perfil →</span></p>
        {/if}
      </a>
    </div>

    <!-- Ganancias -->
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Ganancias</h2>
        <div class="flex rounded-lg border border-stone-700 p-0.5 text-xs">
          <button onclick={() => (granularidad = 'dia')} class="rounded px-2.5 py-1 {granularidad === 'dia' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}">Por día</button>
          <button onclick={() => (granularidad = 'mes')} class="rounded px-2.5 py-1 {granularidad === 'mes' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}">Por mes</button>
        </div>
      </div>
      {#if gananciaData.labels.length === 0}
        <p class="py-16 text-center text-sm text-stone-500">Aún no hay ventas registradas.</p>
      {:else}
        <MiniChart config={gananciaConfig} height="h-64" />
      {/if}
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
