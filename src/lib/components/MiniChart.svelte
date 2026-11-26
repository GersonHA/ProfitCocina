<script lang="ts">
  import Chart from 'chart.js/auto';

  // Config de Chart.js (lo arma quien use el componente). Se deja laxo a
  // propósito: Chart.js tiene tipos muy estrictos para charts combinados.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { config, height = 'h-64' }: { config: any; height?: string } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | undefined;

  $effect(() => {
    const _c = config;
    if (!canvas) return;
    chart?.destroy();
    chart = new Chart(canvas, _c);
    return () => chart?.destroy();
  });
</script>

<div class="{height} w-full">
  <canvas bind:this={canvas}></canvas>
</div>
