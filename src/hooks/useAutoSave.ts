import { useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import type { Client } from '../lib/types';

export function useAutoSave() {
  const updateClient = useAppStore((s) => s.updateClient);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = useCallback(
    (updates: Partial<Client>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        updateClient(updates);
      }, 300);
    },
    [updateClient]
  );

  const saveImmediate = useCallback(
    (updates: Partial<Client>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      updateClient(updates);
    },
    [updateClient]
  );

  return { save, saveImmediate };
}
