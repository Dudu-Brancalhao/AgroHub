import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export const SEARCH_PARAM = 'busca';
export const PAGE_PARAM = 'pagina';

/**
 * The URL is the source of truth for the list's search term and page (FR-024).
 *
 * The component reads from here and dispatches; it never keeps its own copy, which could drift
 * from the address and make a shared or reloaded link show something different.
 */
export function useProducerListParams() {
  const [params, setParams] = useSearchParams();

  const search = params.get(SEARCH_PARAM) ?? '';

  // A hand-edited or stale `pagina` must not propagate into a bad request.
  const rawPage = Number(params.get(PAGE_PARAM) ?? '1');
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  const setSearch = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params);

      if (value.trim() === '') next.delete(SEARCH_PARAM);
      else next.set(SEARCH_PARAM, value);

      // Narrowing the results while sitting on page 7 would show an empty page.
      next.delete(PAGE_PARAM);

      // `replace` so Back does not step through every keystroke of a search.
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setPage = useCallback(
    (value: number) => {
      const next = new URLSearchParams(params);

      // Page 1 is the default, so the clean URL stays `/produtores`.
      if (value <= 1) next.delete(PAGE_PARAM);
      else next.set(PAGE_PARAM, String(value));

      // `push`, unlike search: Back should return to the previous page of results.
      setParams(next);
    },
    [params, setParams],
  );

  return { search, page, setSearch, setPage };
}
