<script lang="ts">
  import { base } from '$app/paths';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import MiniChart from '$lib/components/MiniChart.svelte';

  let { data } = $props();

  const PALETTE = [
    '#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#a855f7', '#f97316',
    '#14b8a6', '#ef4444', '#eab308', '#6366f1', '#06b6d4', '#84cc16',
  ];

  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });

  function nombre(id: string): string {
    const b = data.names[id] ?? id;
    const ench = Number(id.split('@')[1] ?? 0);
    return ench > 0 ? `${b} .${ench}` : b;
  }

  // Miembros presentes (con algún dato).
  const miembros = $derived(
    [...new Set(data.points.map((p) => p.user_id))]
      .map((uid) => ({ uid, nick: data.nicks[uid] ?? '—' }))
      .sort((a, b) => a.nick.localeCompare(b.nick)),
  );

  // Filtros.
  let fUser = $state(''); // '' = todos
  let fItem = $state(''); // '' = todos

  // Filtro de tiempo (Hoy / 7 días / Mes / Todo / Fechas).
  const hoy = new Date();
  function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const MES_NOMBRE = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const meses = $derived([...new Set(data.points.map((p) => p.fecha.slice(0, 7)))].sort().reverse());
  function mesLabel(m: string): string {
    const [y, mm] = m.split('-');
    return `${MES_NOMBRE[Number(mm) - 1]} ${y}`;
  }
  type Periodo = 'hoy' | '7dias' | 'mes' | 'todo' | 'fechas';
  let periodo = $state<Periodo>('todo');
  let mesSel = $state('');
  let desde = $state('');
  let hasta = $state('');
  $effect(() => {
    if (!mesSel && meses.length) mesSel = meses[0];
  });

  const rango = $derived.by<[string, string] | null>(() => {
    if (periodo === 'hoy') return [ymd(hoy), ymd(hoy)];
    if (periodo === '7dias') {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - 6);
      return [ymd(d), ymd(hoy)];
    }
    if (periodo === 'mes' && mesSel) {
      const [y, m] = mesSel.split('-').map(Number);
      return [`${mesSel}-01`, ymd(new Date(y, m, 0))];
    }
    if (periodo === 'fechas') return [desde || '0000-01-01', hasta || '9999-12-31'];
    return null; // 'todo'
  });

  const visibles = $derived(
    data.points.filter(
      (p) =>
        (fUser === '' || p.user_id === fUser) &&
        (fItem === '' || p.item_id === fItem) &&
        (!rango || (p.fecha >= rango[0] && p.fecha <= rango[1])),
    ),
  );

  // Combinaciones (miembro × recurso) visibles = cada una es una línea.
  const combos = $derived.by(() => {
    const seen = new Set<string>();
    const out: { user_id: string; item_id: string }[] = [];
    for (const p of visibles) {
      const k = `${p.user_id}|${p.item_id}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ user_id: p.user_id, item_id: p.item_id });
      }
    }
    return out.sort(
      (a, b) =>
        (data.nicks[a.user_id] ?? '').localeCompare(data.nicks[b.user_id] ?? '') ||
        nombre(a.item_id).localeCompare(nombre(b.item_id)),
    );
  });

  function latest(user_id: string, item_id: string) {
    const ps = data.points
      .filter((p) => p.user_id === user_id && p.item_id === item_id)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return ps[0] ?? null;
  }

  // --- Gráfico dinámico ---
  type Metrica = 'costo' | 'cantidad' | 'total';
  let metrica = $state<Metrica>('costo');
  const metricaLabel: Record<Metrica, string> = {
    costo: 'Costo c/u (silver)',
    cantidad: 'Cantidad (und)',
    total: 'Costo total (silver)',
  };
  const fechas = $derived([...new Set(visibles.map((p) => p.fecha))].sort());
  function valorEn(user_id: string, item_id: string, fecha: string): number | null {
    const p = visibles.find((x) => x.user_id === user_id && x.item_id === item_id && x.fecha === fecha);
    if (!p) return null;
    return metrica === 'costo' ? p.cost : metrica === 'cantidad' ? p.qty : p.cost * p.qty;
  }
  function comboLabel(c: { user_id: string; item_id: string }): string {
    const nick = data.nicks[c.user_id] ?? '—';
    const itn = nombre(c.item_id);
    if (fItem && !fUser) return nick; // un recurso -> por miembro
    if (fUser && !fItem) return itn; // un miembro -> por recurso
    return `${nick} · ${itn}`;
  }
  const chartConfig = $derived.by(() => ({
    type: 'line',
    data: {
      labels: fechas,
      datasets: combos.map((c, i) => ({
        label: comboLabel(c),
        data: fechas.map((f) => valorEn(c.user_id, c.item_id, f)),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: PALETTE[i % PALETTE.length] + '22',
        spanGaps: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: { legend: { labels: { color: '#a8a29e', boxWidth: 10, padding: 10, font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#78716c', maxRotation: 0, autoSkip: true }, grid: { color: '#292524' } },
        y: {
          ticks: { color: '#78716c' },
          grid: { color: '#292524' },
          title: { display: true, text: metricaLabel[metrica], color: '#78716c' },
        },
      },
    },
  }));

  // Clave para forzar recreación del gráfico al cambiar filtros.
  const chartKey = $derived(`${fUser}|${fItem}|${periodo}|${mesSel}|${desde}|${hasta}|${metrica}|${combos.length}`);
</script>

<section class="space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Mercado interno</h1>
      <p class="text-sm text-stone-400">Qué saca cada quien, cuánto y a qué costo. Todos venden a costo; esto es el seguimiento entre ustedes.</p>
    </div>
    <a href="{base}/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">🏠 Inicio</a>
  </div>

  {#if data.points.length === 0}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">
      Todavía no hay producción registrada. El mercado interno se arma solo con los costos de la cadena (Producción).
    </p>
  {:else}
    <!-- Filtro de tiempo -->
    <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-stone-800 bg-stone-900/50 p-3">
      <div class="flex rounded-lg border border-stone-700 p-0.5 text-sm">
        {#each [['hoy', 'Hoy'], ['7dias', '7 días'], ['mes', 'Mes'], ['todo', 'Todo'], ['fechas', 'Fechas']] as [v, l]}
          <button
            onclick={() => (periodo = v as Periodo)}
            class="rounded px-3 py-1 {periodo === v ? 'bg-amber-500 font-medium text-stone-950' : 'text-stone-400 hover:text-stone-100'}"
          >
            {l}
          </button>
        {/each}
      </div>
      {#if periodo === 'mes'}
        <select bind:value={mesSel} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-1.5 text-sm">
          {#each meses as m}<option value={m}>{mesLabel(m)}</option>{/each}
        </select>
      {:else if periodo === 'fechas'}
        <label class="flex items-center gap-1 text-xs text-stone-400">Desde <input type="date" bind:value={desde} class="rounded-lg border border-stone-700 bg-stone-950 px-2 py-1 text-sm" /></label>
        <label class="flex items-center gap-1 text-xs text-stone-400">Hasta <input type="date" bind:value={hasta} class="rounded-lg border border-stone-700 bg-stone-950 px-2 py-1 text-sm" /></label>
      {/if}
    </div>

    <!-- Filtros por miembro / recurso -->
    <div class="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Miembro</span>
        <select bind:value={fUser} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
          <option value="">Todos</option>
          {#each miembros as m}<option value={m.uid}>{m.nick}</option>{/each}
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Recurso</span>
        <select bind:value={fItem} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
          <option value="">Todos</option>
          {#each data.items as it}<option value={it.item_id}>{nombre(it.item_id)}</option>{/each}
        </select>
      </label>
      {#if fUser || fItem}
        <button onclick={() => { fUser = ''; fItem = ''; }} class="rounded-lg border border-stone-700 px-3 py-2 text-xs text-stone-300 hover:bg-stone-800">Limpiar</button>
      {/if}
    </div>

    <!-- Gráfico dinámico -->
    {#if fechas.length > 0 && combos.length > 0}
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Evolución</h2>
          <div class="ml-auto flex rounded-lg border border-stone-700 p-0.5 text-xs">
            {#each [['costo', 'Costo c/u'], ['cantidad', 'Cantidad'], ['total', 'Costo total']] as [v, l]}
              <button
                onclick={() => (metrica = v as Metrica)}
                class="rounded px-2.5 py-1 {metrica === v ? 'bg-amber-500 font-medium text-stone-950' : 'text-stone-400 hover:text-stone-100'}"
              >
                {l}
              </button>
            {/each}
          </div>
        </div>
        {#key chartKey}
          <MiniChart config={chartConfig} height="h-80" />
        {/key}
      </div>
    {/if}

    <!-- Vista general (actual): miembro, recurso, cantidad y costo -->
    <div>
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Vista general (actual)</h2>
      <div class="overflow-x-auto rounded-2xl border border-stone-800">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-stone-800 text-stone-400">
              <th class="px-4 py-2 text-left font-medium">Miembro</th>
              <th class="px-4 py-2 text-left font-medium">Recurso</th>
              <th class="px-4 py-2 text-right font-medium">Cantidad</th>
              <th class="px-4 py-2 text-right font-medium">Costo c/u</th>
              <th class="px-4 py-2 text-right font-medium">Costo total</th>
            </tr>
          </thead>
          <tbody>
            {#each combos as c}
              {@const l = latest(c.user_id, c.item_id)}
              <tr class="border-b border-stone-800/60 last:border-b-0">
                <td class="px-4 py-2">{data.nicks[c.user_id] ?? '—'}</td>
                <td class="px-4 py-2">
                  <span class="flex items-center gap-2">
                    <ItemImg itemId={c.item_id} nombre={nombre(c.item_id)} size={20} />{nombre(c.item_id)}
                  </span>
                </td>
                <td class="px-4 py-2 text-right tabular-nums text-stone-300">{l ? fmt(l.qty) : '—'}</td>
                <td class="px-4 py-2 text-right font-semibold tabular-nums text-amber-300">{l ? fmt(l.cost) : '—'}</td>
                <td class="px-4 py-2 text-right tabular-nums text-stone-300">{l ? fmt(l.qty * l.cost) : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-stone-500"><strong>Cantidad</strong> = tu stock del recurso · <strong>Costo c/u</strong> = su costo de producción (tu precio interno) · <strong>Costo total</strong> = cantidad × c/u (el silver que representa). El gráfico de arriba muestra cualquiera de las tres en el tiempo.</p>
    </div>
  {/if}
</section>
