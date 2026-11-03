import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
    // If input is a Request instance, let native fetch handle it directly without disturbing the body stream
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return await fetch(input);
    }

    const headers = new Headers(init?.headers);
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return await fetch(input, { ...init, headers });
  };
}

const DEFAULT_SUPABASE_URL = 'https://zftztrmbmcpzgxwmpybv.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_cScFpCwDPCBXSbtf1I1WHw_w1x_1tPn';

function resolveSupabaseUrl(): string {
  const candidate =
    import.meta.env['VITE_SUPABASE_URL'] ||
    process.env['VITE_SUPABASE_URL'] ||
    process.env['SUPABASE_URL'];
  if (candidate && !candidate.includes('xxxxxxxx')) {
    return candidate.replace(/\/+$/, '');
  }
  return DEFAULT_SUPABASE_URL;
}

function resolveSupabaseKey(): string {
  const candidate =
    import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
    process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
    process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (candidate && !candidate.includes('xxxxxxxx')) {
    return candidate;
  }
  return DEFAULT_SUPABASE_KEY;
}

function createSupabaseClient() {
  const SUPABASE_URL = resolveSupabaseUrl();
  const SUPABASE_PUBLISHABLE_KEY = resolveSupabaseKey();

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

