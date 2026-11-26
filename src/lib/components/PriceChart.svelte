<script lang="ts">
  import Chart from 'chart.js/auto';

  let {
    labels,
    precio,
    volumen,
    labelPrecio = 'Precio de venta',
  }: {
    labels: string[];
    precio: number[];
    volumen: number[];
    labelPrecio?: string;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | undefined;

  // Reconstruye el gráfico cada vez que cambian los datos (son pocos puntos).
  $effect(() => {
    // dependencias
    const _l = labels;
    const _p = precio;
    const _v = volumen;
    if (!canvas) return;

    chart?.destroy();
    chart = new Chart(canvas, {
      data: {
        labels: _l,
        datasets: [
          {
            type: 'bar',
            label: 'Volumen vendido',
            data: _v,
            yAxisID: 'y1',
            backgroundColor: 'rgba(120, 113, 108, 0.45)',
            order: 2,
          },
          {
            type: 'line',
            label: labelPrecio,
            data: _p,
            yAxisID: 'y',
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b',
            tension: 0.25,
            pointRadius: 3,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            position: 'left',
            title: { display: true, text: 'Precio', color: '#a8a29e' },
            ticks: { color: '#d6d3d1' },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'Volumen', color: '#a8a29e' },
            ticks: { color: '#a8a29e' },
            grid: { drawOnChartArea: false },
          },
          x: { ticks: { color: '#a8a29e' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        },
        plugins: { legend: { labels: { color: '#d6d3d1' } } },
      },
    });

    return () => chart?.destroy();
  });
</script>

<div class="h-72 w-full">
  <canvas bind:this={canvas}></canvas>
</div>
