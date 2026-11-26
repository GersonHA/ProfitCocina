<script lang="ts">
  import Chart from 'chart.js/auto';

  interface CitySeries {
    name: string;
    color: string;
    price: (number | null)[];
    volume: (number | null)[];
  }

  let {
    labels,
    cities,
    totalVolume,
  }: { labels: string[]; cities: CitySeries[]; totalVolume: number[] } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | undefined;

  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });

  $effect(() => {
    // dependencias
    const _l = labels;
    const _c = cities;
    const _tv = totalVolume;
    if (!canvas) return;

    // Las líneas ocupan ~60% superior (espacio para separarlas); las barras,
    // el ~36% inferior.
    const precios = _c.flatMap((c) => c.price).filter((v): v is number => v != null);
    const pmax = precios.length ? Math.max(...precios) : 1;
    const pmin = precios.length ? Math.min(...precios) : 0;
    const rango = pmax - pmin || Math.max(1, pmax * 0.05);
    const yMin = pmin - rango; // líneas en la mitad superior
    const yMax = pmax + rango * 0.1;

    const maxVol = Math.max(1, ..._tv);
    const y1Max = maxVol * 2;

    const datasets: Record<string, unknown>[] = [
      {
        type: 'bar',
        label: 'Volumen total',
        data: _tv,
        yAxisID: 'y1',
        backgroundColor: 'rgba(150, 150, 150, 0.32)',
        borderWidth: 0,
        order: 10,
      },
      ..._c.map((c) => ({
        type: 'line',
        label: c.name,
        data: c.price,
        yAxisID: 'y',
        borderColor: c.color,
        backgroundColor: c.color,
        tension: 0.25,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        borderWidth: 2,
        spanGaps: true,
        order: 1,
        _volume: c.volume,
      })),
    ];

    chart?.destroy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart = new Chart(canvas, {
      data: { labels: _l, datasets: datasets as never },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 10, bottom: 6, left: 6, right: 10 } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            position: 'left',
            min: yMin,
            max: yMax,
            title: { display: true, text: 'Precio', color: '#a8a29e' },
            ticks: { color: '#d6d3d1' },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y1: { position: 'right', min: 0, max: y1Max, display: false },
          x: { ticks: { color: '#a8a29e' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        },
        plugins: {
          legend: { labels: { color: '#d6d3d1', usePointStyle: true, boxWidth: 6, padding: 12, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const ds = ctx.dataset as { type?: string; label?: string; _volume?: (number | null)[] };
                const y = ctx.parsed.y ?? 0;
                if (ds.type === 'bar') return `Volumen total: ${fmt(y)}`;
                const vol = ds._volume?.[ctx.dataIndex];
                return `${ds.label}: ${fmt(y)}  ·  vol ${vol != null ? fmt(vol) : '—'}`;
              },
            },
          },
        },
      },
    });

    return () => chart?.destroy();
  });
</script>

<div class="h-80 w-full">
  <canvas bind:this={canvas}></canvas>
</div>
