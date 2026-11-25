<script lang="ts">
  let { data } = $props();

  const CARDS = [
    { href: '/cadena', emoji: '🔗', title: 'Mi cadena (recomendado)', desc: 'Registro guiado paso a paso de tu producción.' },
    { href: '/registrar/lote', emoji: '🌾', title: 'Lote (avanzado)', desc: 'Formulario completo: entradas, gastos, salidas.' },
    { href: '/registrar/mercado', emoji: '🏪', title: 'Mercado', desc: 'Compra o venta en el mercado.' },
    { href: '/registrar/compra-miembro', emoji: '🤝', title: 'Comprar a un miembro', desc: 'Al costo del vendedor.' },
    { href: '/registrar/ajuste', emoji: '⚖️', title: 'Ajuste de stock', desc: 'Conteo, pérdida o consumo.' },
  ];
</script>

<section class="space-y-5">
  <h1 class="text-2xl font-semibold">¿Qué quieres registrar?</h1>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
      No tienes un grupo activo. Pide que te inviten a uno.
    </p>
  {:else}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {#each CARDS as c}
        <a
          href={c.href}
          class="flex items-start gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4 transition hover:border-amber-500/50 hover:bg-stone-900"
        >
          <span class="text-2xl">{c.emoji}</span>
          <span>
            <span class="block font-medium">{c.title}</span>
            <span class="block text-sm text-stone-400">{c.desc}</span>
          </span>
        </a>
      {/each}
    </div>
  {/if}
</section>
