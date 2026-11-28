/* query-params.ts — read and write URL query parameters of the current route.
   State that must survive a reload or be linkable (active tab, filter) lives
   in the query; this is the one place that edits it. */
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * `get` reads one parameter of the current URL. `set` replaces it (or removes
 * it when the value is `null`) and keeps every other parameter, without adding
 * a history entry.
 */
export function useQueryParams() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  const get = (key: string): string | null => search.get(key);

  const set = (key: string, value: string | null): void => {
    const next = new URLSearchParams(search.toString());
    if (value == null) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return { get, set };
}
