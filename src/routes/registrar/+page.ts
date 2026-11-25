/** El hub ahora vive en el inicio; /registrar redirige allí. */
import { redirect } from '@sveltejs/kit';

export function load() {
  throw redirect(307, '/');
}
