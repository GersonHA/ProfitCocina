<script lang="ts">
  import { base } from '$app/paths';
  import { supabase } from '$lib/supabase';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import { RESOURCE_GROUPS, resourceNombre } from '$lib/resources';

  let { data } = $props();

  // Valores iniciales desde data (envueltos en funciones para no capturar el prop en el init).
  const init = () => data;
  let nick = $state(init().nick);
  let juego = $state(init().juego);
  let gremio = $state(init().gremio);
  let discord = $state(init().discord);
  let produces = $state<string[]>(init().produces);
  let premium = $state(init().premium);
  let notas = $state(init().notas);
  let islas = $state<number | null>(init().islas);
  let islasNotas = $state(init().islasNotas);

  function toggleProduce(id: string) {
    produces = produces.includes(id) ? produces.filter((x) => x !== id) : [...produces, id];
  }
  let metaAmount = $state<number | null>(init().metaAmount);
  let metaPeriod = $state<'day' | 'week' | 'month'>(init().metaPeriod);

  // Auto-guardado: cualquier cambio se sincroniza solo (sin botón).
  let status = $state<'' | 'saving' | 'saved' | 'error'>('');
  let errMsg = $state('');
  let primeraPasada = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function save() {
    status = 'saving';
    errMsg = '';
    try {
      const { error: e1 } = await supabase
        .from('profiles')
        .update({
          nick: nick.trim() || null,
          premium,
          especializaciones: {
            produces,
            juego: juego.trim() || undefined,
            gremio: gremio.trim() || undefined,
            discord: discord.trim() || undefined,
            notas: notas.trim() || undefined,
            islas: islas ?? undefined,
            islasNotas: islasNotas.trim() || undefined,
          },
          meta_amount: metaAmount,
          meta_period: metaPeriod,
        })
        .eq('user_id', data.meId);
      if (e1) throw e1;
      status = 'saved';
    } catch (err) {
      status = 'error';
      errMsg = err instanceof Error ? err.message : String(err);
    }
  }

  $effect(() => {
    // Leer los campos aquí los vuelve dependencias: el efecto corre con cualquier cambio.
    void [nick, juego, gremio, discord, produces, premium, notas, islas, islasNotas, metaAmount, metaPeriod];
    if (primeraPasada) {
      primeraPasada = false;
      return; // no guardar al montar
    }
    status = 'saving';
    clearTimeout(timer);
    timer = setTimeout(save, 600);
  });
</script>

<section class="mx-auto max-w-2xl space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Mi perfil</h1>
    <a href="{base}/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">← Panel</a>
  </div>
  <p class="text-sm text-stone-400">Tu correo: <span class="text-stone-200">{data.email}</span></p>

  <!-- Datos del jugador -->
  <div class="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
    <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Datos del jugador</h2>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Nick (en la app)</span>
        <input type="text" bind:value={nick} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Nombre en el juego</span>
        <input type="text" bind:value={juego} placeholder="tu personaje de Albion" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Gremio</span>
        <input type="text" bind:value={gremio} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Discord / contacto</span>
        <input type="text" bind:value={discord} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Islas (cuántas tienes)</span>
        <input type="number" bind:value={islas} min="0" placeholder="ej. 2" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="flex items-center gap-2 pt-6 text-sm">
        <input type="checkbox" bind:checked={premium} class="size-4" />
        Tengo Premium (afecta el impuesto de venta)
      </label>
    </div>

    <!-- Qué produce (uno o varios) -->
    <div>
      <span class="mb-1 block text-xs text-stone-400">¿Qué produces? (elige uno o varios)</span>
      <div class="space-y-2">
        {#each RESOURCE_GROUPS as g}
          <div>
            <p class="mb-1 text-[11px] tracking-wide text-stone-500 uppercase">{g.grupo}</p>
            <div class="flex flex-wrap gap-1.5">
              {#each g.items as it}
                <button
                  type="button"
                  onclick={() => toggleProduce(it.id)}
                  class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition {produces.includes(it.id)
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                    : 'border-stone-700 text-stone-400 hover:bg-stone-800'}"
                >
                  <ItemImg itemId={it.id} nombre={it.nombre} size={16} />
                  {it.nombre}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      {#if produces.length}
        <p class="mt-2 text-xs text-stone-500">Produces: <span class="text-stone-300">{produces.map(resourceNombre).join(', ')}</span></p>
      {/if}
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Notas (opcional)</span>
        <input type="text" bind:value={notas} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Notas de islas (opcional)</span>
        <input type="text" bind:value={islasNotas} placeholder="ej. Isla 1: 6 parcelas calabaza" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
    </div>
  </div>

  <!-- Meta -->
  <div class="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
    <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Meta de ganancia</h2>
    <p class="text-xs text-stone-500">Tu objetivo de ganancia; el progreso se ve en el Panel.</p>
    <div class="flex gap-2">
      <input type="number" bind:value={metaAmount} min="0" placeholder="silver objetivo" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      <select bind:value={metaPeriod} class="rounded-lg border border-stone-700 bg-stone-950 px-2 py-2">
        <option value="day">por día</option>
        <option value="week">por semana</option>
        <option value="month">por mes</option>
      </select>
    </div>
  </div>

  <div class="flex items-center gap-2 text-sm">
    {#if status === 'saving'}
      <span class="text-stone-400">Guardando…</span>
    {:else if status === 'saved'}
      <span class="text-green-400">✓ Guardado</span>
    {:else if status === 'error'}
      <span class="text-red-300">Error al guardar: {errMsg}</span>
    {:else}
      <span class="text-stone-500">Los cambios se guardan solos.</span>
    {/if}
  </div>
</section>
