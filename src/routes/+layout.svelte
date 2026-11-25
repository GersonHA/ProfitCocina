<script lang="ts">
  import '../app.css';
  import { supabase } from '$lib/supabase';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';

  let { data, children } = $props();

  const NAV = [
    { href: '/', label: 'Inicio' },
    { href: '/mi-produccion', label: 'Mi producción' },
    { href: '/justicia', label: 'Justicia' },
  ];

  const path = $derived($page.url.pathname);

  async function logout() {
    await supabase.auth.signOut();
    await invalidateAll();
    await goto('/login');
  }
</script>

<div class="min-h-screen bg-stone-950 text-stone-100">
  {#if data.session}
    <header class="sticky top-0 z-10 border-b border-stone-800 bg-stone-900/80 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <a href="/" class="flex items-center gap-2 font-semibold">
          <span class="text-xl">🍲</span>
          <span class="hidden sm:inline">Profit Cocina</span>
        </a>
        <nav class="flex items-center gap-1 text-sm">
          {#each NAV as item}
            <a
              href={item.href}
              class="rounded-lg px-2.5 py-1.5 transition {path === item.href
                ? 'bg-amber-500/15 text-amber-300'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'}"
            >
              {item.label}
            </a>
          {/each}
          <button
            onclick={logout}
            class="ml-1 rounded-lg border border-stone-700 px-2.5 py-1.5 text-stone-300 transition hover:bg-stone-800"
          >
            Salir
          </button>
        </nav>
      </div>
      {#if data.group}
        <div class="border-t border-stone-800/60 bg-stone-900/40">
          <a href="/grupo" class="mx-auto block max-w-3xl px-4 py-1.5 text-xs text-stone-500 hover:text-stone-300">
            Grupo: <span class="text-stone-300">{data.group.name}</span>
            · {data.group.server} <span class="text-stone-600">· ver equipo →</span>
          </a>
        </div>
      {/if}
    </header>
  {/if}

  <main class="mx-auto w-full max-w-3xl px-4 py-6">
    {@render children()}
  </main>
</div>
