import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Patches the page's query string in place (no history entry, no scroll), keeping params it doesn't name.
 * Several calls in one handler build on each other rather than on the stale searchParams.
 */
export function useSetQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const latest = useRef(searchParams.toString());

  useEffect(() => {
    latest.current = searchParams.toString();
  }, [searchParams]);

  return useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(latest.current);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      latest.current = next.toString();
      router.replace(latest.current ? `${pathname}?${latest.current}` : pathname, { scroll: false });
    },
    [router, pathname]
  );
}

/** True while the media query matches. False on the server and the first render. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}
