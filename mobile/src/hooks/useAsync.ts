import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { errorMessage } from '@/lib/format';

type State<T> = { data: T | undefined; error: string | null; loading: boolean; refreshing: boolean };

// Charge les données à chaque retour sur l'écran, et expose un rafraîchissement manuel (pull-to-refresh).
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true, refreshing: false });
  const requestId = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loader = useCallback(load, deps);

  const run = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const id = ++requestId.current;
      setState((s) => ({ ...s, loading: mode === 'initial' && s.data === undefined, refreshing: mode === 'refresh' }));
      try {
        const data = await loader();
        if (id === requestId.current) setState({ data, error: null, loading: false, refreshing: false });
      } catch (e) {
        if (id === requestId.current) setState((s) => ({ ...s, error: errorMessage(e), loading: false, refreshing: false }));
      }
    },
    [loader],
  );

  useFocusEffect(
    useCallback(() => {
      run('initial');
    }, [run]),
  );

  return { ...state, refresh: () => run('refresh'), reload: () => run('initial') };
}
