<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import { resourceNombre } from '$lib/resources';
  import { removeMember, updateMember } from '$lib/admin';

  interface Member {
    userId: string;
    nick: string;
    produces: string[];
    role: string;
  }

  let {
    member,
    groupId,
    isSelf,
  }: { member: Member; groupId: string; isSelf: boolean } = $props();

  function m0() {
    return member;
  }

  let open = $state(false);
  let nick = $state(m0().nick);
  let role = $state<'member' | 'admin'>(m0().role === 'admin' ? 'admin' : 'member');
  let password = $state('');
  let saving = $state(false);
  let error = $state('');

  async function guardar() {
    error = '';
    saving = true;
    try {
      await updateMember({
        groupId,
        targetId: member.userId,
        nick: nick.trim() || member.nick,
        role,
        password: password.length >= 6 ? password : undefined,
      });
      password = '';
      open = false;
      await invalidateAll();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }

  async function quitar() {
    if (!confirm(`¿Quitar a ${member.nick} del grupo?`)) return;
    error = '';
    saving = true;
    try {
      await removeMember(groupId, member.userId);
      await invalidateAll();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      saving = false;
    }
  }
</script>

<li class="py-2.5">
  <div class="flex items-center justify-between">
    <span class="flex items-center gap-2.5">
      <span class="flex items-center gap-0.5">
        {#each member.produces.slice(0, 5) as pid}
          <ItemImg itemId={pid} nombre={resourceNombre(pid)} size={24} />
        {/each}
        {#if member.produces.length === 0}<span class="text-lg">📦</span>{/if}
      </span>
      <span class="font-medium">{member.nick}</span>
      {#if member.role === 'admin'}
        <span class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">admin</span>
      {/if}
      {#if isSelf}<span class="text-[10px] text-stone-500">(tú)</span>{/if}
    </span>
    <span class="flex items-center gap-2">
      <span class="hidden text-sm text-stone-400 sm:inline">{member.produces.map(resourceNombre).join(', ') || '—'}</span>
      <button onclick={() => (open = !open)} class="rounded-lg border border-stone-700 px-2 py-1 text-xs hover:bg-stone-800">
        {open ? 'Cerrar' : 'Editar'}
      </button>
    </span>
  </div>

  {#if open}
    <div class="mt-3 space-y-3 rounded-xl border border-stone-800 bg-stone-950/40 p-3">
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Nick</span>
          <input type="text" bind:value={nick} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Rol</span>
          <select bind:value={role} disabled={isSelf} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm disabled:opacity-50">
            <option value="member">miembro</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-stone-400">Nueva contraseña (opcional)</span>
          <input type="text" bind:value={password} placeholder="dejar vacío = sin cambio" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm" />
        </label>
      </div>

      {#if error}
        <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      {/if}

      <div class="flex items-center justify-between">
        <button
          onclick={quitar}
          disabled={saving || isSelf}
          class="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
        >
          Quitar del grupo
        </button>
        <button
          onclick={guardar}
          disabled={saving}
          class="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  {/if}
</li>
