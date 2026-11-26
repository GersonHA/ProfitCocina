<script lang="ts">
  const OPCIONES = [
    { href: '/cadena', emoji: '🔗', titulo: 'Mi cadena', desc: 'Registra tu producción paso a paso (siembra, cría, refinado, cocina).' },
    { href: '/tienda', emoji: '📋', titulo: 'Crear orden', desc: 'Planifica un platillo y haz una orden con seguimiento (compras → cocina).' },
    { href: '/registrar/mercado', emoji: '🏷️', titulo: 'Vender', desc: 'Vende lo que produjiste: sale de tu inventario y registra la venta con impuesto.' },
    { href: '/registrar/compra-miembro', emoji: '🤝', titulo: 'Comprar a un miembro', desc: 'Registra lo que le compras a otro miembro del grupo.' },
    { href: '/registrar/ajuste', emoji: '⚖️', titulo: 'Ajuste / pérdida', desc: 'Corrige el stock o registra una pérdida (gank, items borrados).' },
    { href: '/precios', emoji: '💲', titulo: 'Precios de mercado', desc: 'Anota el precio del día de tus items y platillos.' },
  ];
</script>

<section class="space-y-5">
  <div>
    <h1 class="text-2xl font-semibold">¿Qué quieres registrar?</h1>
    <p class="mt-1 text-sm text-stone-400">Elige una acción. Todo lo que registres actualiza tu inventario y costos automáticamente.</p>
  </div>

  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {#each OPCIONES as o}
      <a
        href={o.href}
        class="flex items-start gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4 transition hover:border-amber-500/40 hover:bg-stone-900"
      >
        <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-950 text-xl">{o.emoji}</span>
        <div>
          <p class="font-medium">{o.titulo}</p>
          <p class="mt-0.5 text-xs text-stone-500">{o.desc}</p>
        </div>
      </a>
    {/each}
  </div>
</section>
