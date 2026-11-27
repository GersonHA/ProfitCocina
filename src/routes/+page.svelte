<script lang="ts">
  import { base } from '$app/paths';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import MiniChart from '$lib/components/MiniChart.svelte';

  let { data } = $props();

  const ACCIONES = [
    { href: '/cadena', emoji: '🔗', label: 'Mi cadena', primary: true },
    { href: '/registrar/mercado', emoji: '🏷️', label: 'Vender' },
    { href: '/registrar/compra-miembro', emoji: '🤝', label: 'Comprar a un miembro' },
    { href: '/registrar/ajuste', emoji: '⚖️', label: 'Ajuste / pérdida' },
    { href: '/precios', emoji: '📈', label: 'Mercado interno' },
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
    return Math.round(Number(n)).toLocaleString('es-ES', { useGrouping: 'always' });
  }
  function sM(n: number): string {
    const v = Math.round(n);
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + ' M';
    if (a >= 1e3) return (v / 1e3).toFixed(1).replace('.', ',') + ' k';
    return v.toLocaleString('es-ES', { useGrouping: 'always' });
  }
  function fechaKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // --- Selector de período ---
  const PERIODOS = [
    { id: 'hoy', label: 'Hoy' },
    { id: '7dias', label: '7 días' },
    { id: 'mes', label: 'Mes' },
    { id: 'todo', label: 'Todo' },
  ];
  let periodo = $state<'hoy' | '7dias' | 'mes' | 'todo'>('todo');
  let granularidad = $state<'dia' | 'mes'>('dia');

  function rangoPeriodo(p: string): { from: string; to: string } {
    const now = new Date();
    const today = fechaKey(now);
    if (p === 'hoy') return { from: today, to: today };
    if (p === '7dias') {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { from: fechaKey(s), to: today };
    }
    if (p === 'mes') return { from: today.slice(0, 7) + '-01', to: today };
    return { from: '0000-01-01', to: '9999-12-31' };
  }

  const filas = $derived.by(() => {
    const { from, to } = rangoPeriodo(periodo);
    return data.dailyData.filter((r) => r.fecha >= from && r.fecha <= to);
  });

  const kpi = $derived.by(() => {
    const invested = filas.reduce((s, r) => s + r.invested, 0);
    const ventas = filas.reduce((s, r) => s + r.ventas, 0);
    const cogs = filas.reduce((s, r) => s + r.cogs, 0);
    const perdida = filas.reduce((s, r) => s + r.perdida, 0);
    const ganancia = ventas - cogs;
    return { invested, ventas, ganancia, roi: invested > 0 ? ganancia / invested : 0, perdida };
  });

  // --- Gráfico de ganancias ---
  const gananciaData = $derived.by(() => {
    if (granularidad === 'mes') {
      const byMonth = new Map<string, number>();
      for (const r of filas) {
        const k = r.fecha.slice(0, 7);
        byMonth.set(k, (byMonth.get(k) ?? 0) + (r.ventas - r.cogs));
      }
      const labels = [...byMonth.keys()].sort();
      return { labels, values: labels.map((l) => byMonth.get(l)!) };
    }
    return { labels: filas.map((r) => r.fecha), values: filas.map((r) => r.ventas - r.cogs) };
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

  // --- Meta (gauge + ritmo) ---
  const META_LABEL: Record<string, string> = { day: 'hoy', week: 'esta semana', month: 'este mes' };
  const meta = $derived.by(() => {
    const amount = data.metaAmount ?? 0;
    const now = new Date();
    const today = fechaKey(now);
    let from = today;
    let diasTotales = 1;
    let transcurridos = 1;
    if (data.metaPeriod === 'week') {
      const dow = (now.getDay() + 6) % 7; // 0 = lunes
      const mon = new Date(now);
      mon.setDate(now.getDate() - dow);
      from = fechaKey(mon);
      diasTotales = 7;
      transcurridos = dow + 1;
    } else if (data.metaPeriod === 'month') {
      from = today.slice(0, 7) + '-01';
      diasTotales = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      transcurridos = now.getDate();
    }
    const logrado = data.dailyData
      .filter((r) => r.fecha >= from && r.fecha <= today)
      .reduce((s, r) => s + (r.ventas - r.cogs), 0);
    const restantes = Math.max(0, diasTotales - transcurridos);
    const falta = Math.max(0, amount - logrado);
    const sobra = Math.max(0, logrado - amount);
    const pct = amount > 0 ? logrado / amount : 0;
    return {
      amount,
      logrado,
      pct,
      falta,
      sobra,
      cumplida: amount > 0 && logrado >= amount,
      restantes,
      ritmoNecesario: falta > 0 ? falta / (restantes + 1) : 0,
      proyeccion: transcurridos > 0 ? (logrado / transcurridos) * diasTotales : 0,
    };
  });

  const gaugeConfig = $derived({
    type: 'doughnut',
    data: {
      datasets: [
        {
          data: [Math.min(1, meta.pct), Math.max(0, 1 - Math.min(1, meta.pct))],
          backgroundColor: [meta.cumplida ? '#22c55e' : '#f59e0b', '#292524'],
          borderWidth: 0,
          circumference: 180,
          rotation: -90,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
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
        href="{base}{a.href}"
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
    <!-- Período -->
    <div class="flex rounded-xl border border-stone-700 p-0.5 text-sm w-fit">
      {#each PERIODOS as p}
        <button
          onclick={() => (periodo = p.id as typeof periodo)}
          class="rounded-lg px-3 py-1.5 transition {periodo === p.id ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-100'}"
        >
          {p.label}
        </button>
      {/each}
    </div>

    <!-- KPIs del período -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Invertido</p>
        <p class="mt-1 text-2xl font-semibold text-orange-300 tabular-nums">{sM(kpi.invested)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Ventas (neto)</p>
        <p class="mt-1 text-2xl font-semibold text-blue-300 tabular-nums">{sM(kpi.ventas)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Ganancia</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums {kpi.ganancia >= 0 ? 'text-green-300' : 'text-red-300'}">{sM(kpi.ganancia)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">ROI</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums {kpi.roi >= 0 ? 'text-green-300' : 'text-red-300'}">{(kpi.roi * 100).toFixed(0)}%</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Pérdidas</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums {kpi.perdida > 0 ? 'text-red-300' : 'text-stone-300'}">{sM(kpi.perdida)}</p>
      </div>
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <p class="text-xs text-stone-500">Valor inventario</p>
        <p class="mt-1 text-2xl font-semibold text-amber-300 tabular-nums">{sM(data.invValue)}</p>
      </div>
    </div>

    <!-- Meta (gauge) + Ganancias -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <div class="mb-1 flex items-center justify-between">
          <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Meta</h2>
          <a href="{base}/perfil" class="text-xs text-amber-300 hover:underline">editar</a>
        </div>
        {#if data.metaAmount && data.metaAmount > 0}
          <div class="relative mx-auto h-32 max-w-[14rem]">
            <MiniChart config={gaugeConfig} height="h-32" />
            <div class="absolute inset-x-0 bottom-0 flex flex-col items-center">
              <span class="text-2xl font-bold {meta.cumplida ? 'text-green-300' : 'text-amber-300'}">{(meta.pct * 100).toFixed(0)}%</span>
              <span class="text-[10px] text-stone-500">de la meta {META_LABEL[data.metaPeriod]}</span>
            </div>
          </div>
          <div class="mt-2 space-y-1 text-sm">
            <div class="flex justify-between"><span class="text-stone-400">Llevas</span><span class="tabular-nums">{sM(meta.logrado)}</span></div>
            <div class="flex justify-between"><span class="text-stone-400">Meta</span><span class="tabular-nums">{sM(meta.amount)}</span></div>
            {#if meta.cumplida}
              <div class="flex justify-between"><span class="text-stone-400">De sobra</span><span class="tabular-nums text-green-300">{sM(meta.sobra)}</span></div>
            {:else}
              <div class="flex justify-between"><span class="text-stone-400">Falta</span><span class="tabular-nums text-amber-300">{sM(meta.falta)}</span></div>
              <div class="flex justify-between"><span class="text-stone-400">Ritmo necesario</span><span class="tabular-nums">{sM(meta.ritmoNecesario)}/día</span></div>
            {/if}
            <div class="flex justify-between"><span class="text-stone-400">Días restantes</span><span class="tabular-nums">{meta.restantes}</span></div>
            <div class="flex justify-between border-t border-stone-800 pt-1"><span class="text-stone-400">A este ritmo terminas en</span><span class="tabular-nums">{sM(meta.proyeccion)}</span></div>
            {#if meta.cumplida}<p class="pt-1 text-center text-green-300">🎉 Meta cumplida</p>{/if}
          </div>
        {:else}
          <p class="py-12 text-center text-sm text-stone-500">Pon tu meta en el <a href="{base}/perfil" class="text-amber-300 underline">Perfil</a>.</p>
        {/if}
      </div>

      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4 lg:col-span-2">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Ganancias</h2>
          <div class="flex rounded-lg border border-stone-700 p-0.5 text-xs">
            <button onclick={() => (granularidad = 'dia')} class="rounded px-2.5 py-1 {granularidad === 'dia' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}">Por día</button>
            <button onclick={() => (granularidad = 'mes')} class="rounded px-2.5 py-1 {granularidad === 'mes' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}">Por mes</button>
          </div>
        </div>
        {#if gananciaData.labels.length === 0}
          <p class="py-16 text-center text-sm text-stone-500">Sin ventas en este período.</p>
        {:else}
          <MiniChart config={gananciaConfig} height="h-64" />
        {/if}
      </div>
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
