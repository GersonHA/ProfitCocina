<script lang="ts">
  let { data } = $props();

  const PRODUCE_EMOJI: Record<string, string> = {
    pan: '🥖',
    ternera: '🥩',
    calabaza: '🎃',
  };

  function emoji(p: string | null | undefined): string {
    return (p && PRODUCE_EMOJI[p]) || '📦';
  }
</script>

<section class="space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">
      Hola, {data.nick ?? data.email} 👋
    </h1>
    <p class="mt-1 text-sm text-stone-400">
      Produces {emoji(data.produce)} <span class="text-stone-200">{data.produce ?? '—'}</span>
      · Premium: <span class="text-stone-200">{data.premium ? 'sí' : 'no'}</span>
    </p>
  </div>

  <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
    <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">Tus grupos</h2>
    {#if data.memberships.length === 0}
      <p class="text-stone-400">Todavía no estás en ningún grupo.</p>
    {:else}
      <ul class="space-y-2">
        {#each data.memberships as m}
          <li class="flex items-center justify-between rounded-lg bg-stone-800/50 px-3 py-2">
            <span>{m.name}</span>
            <span class="text-xs text-stone-400">{m.server} · {m.role}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if data.roster.length > 0}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
      <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">
        Equipo de {data.groupName}
      </h2>
      <ul class="divide-y divide-stone-800">
        {#each data.roster as r}
          <li class="flex items-center justify-between py-2.5">
            <span class="flex items-center gap-2">
              <span class="text-lg">{emoji(r.produce)}</span>
              <span class="font-medium">{r.nick}</span>
              {#if r.role === 'admin'}
                <span class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">admin</span>
              {/if}
            </span>
            <span class="text-sm text-stone-400">{r.produce}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <p class="text-center text-xs text-stone-600">
    Fase 0 — esqueleto de la app. Registrar lotes, Kardex y comparador vienen en las siguientes fases.
  </p>
</section>
