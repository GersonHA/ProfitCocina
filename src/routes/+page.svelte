<script lang="ts">
  let { data } = $props();

  const CARDS = [
    { href: '/registrar/mercado', emoji: '🏪', title: 'Mercado', desc: 'Compra o venta en el mercado.' },
    { href: '/registrar/compra-miembro', emoji: '🤝', title: 'Comprar a un miembro', desc: 'Al costo del vendedor.' },
    { href: '/registrar/ajuste', emoji: '⚖️', title: 'Ajuste de stock', desc: 'Conteo, pérdida o consumo.' },
    { href: '/precios', emoji: '💲', title: 'Precios de mercado', desc: 'Anota los precios para el comparador.' },
    { href: '/registrar/lote', emoji: '🌾', title: 'Lote (avanzado)', desc: 'Formulario completo: entradas, gastos, salidas.' },
  ];
</script>

<section class="space-y-5">
  <div>
    <p class="text-sm text-stone-400">Hola, {data.nick ?? 'cocinero'} 👋</p>
    <h1 class="text-2xl font-semibold">¿Qué quieres registrar?</h1>
  </div>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
      No tienes un grupo activo. Pide que te inviten a uno.
    </p>
  {:else}
    <!-- Mi cadena: la acción principal -->
    <a
      href="/cadena"
      class="flex items-center gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 transition hover:bg-amber-500/10"
    >
      <span class="text-3xl">🔗</span>
      <span class="flex-1">
        <span class="block text-lg font-semibold text-amber-200">Mi cadena</span>
        <span class="block text-sm text-stone-400">Registra tu producción paso a paso (lo que haces a diario).</span>
      </span>
      <span class="text-amber-400">→</span>
    </a>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {#each CARDS as c}
        <a
          href={c.href}
          class="flex items-start gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4 transition hover:border-stone-600 hover:bg-stone-900"
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
