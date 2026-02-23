import { create } from 'zustand';
import type { Client } from '../lib/types';
import { db } from '../db';

interface AppState {
  currentClient: Client | null;
  clients: Client[];
  sidebarCollapsed: boolean;

  setCurrentClient: (client: Client | null) => void;
  updateClient: (updates: Partial<Client>) => Promise<void>;
  loadClients: () => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentClient: null,
  clients: [],
  sidebarCollapsed: false,

  setCurrentClient: (client) => set({ currentClient: client }),

  updateClient: async (updates) => {
    const current = get().currentClient;
    if (!current) return;

    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };

    await db.clients.put(updated);
    set({ currentClient: updated });

    // Update the clients list too
    const clients = get().clients.map((c) =>
      c.id === updated.id ? updated : c
    );
    set({ clients });
  },

  loadClients: async () => {
    const clients = await db.clients.orderBy('updatedAt').reverse().toArray();
    set({ clients });
  },

  deleteClient: async (id) => {
    await db.clients.delete(id);
    const clients = get().clients.filter((c) => c.id !== id);
    set({ clients });
    if (get().currentClient?.id === id) {
      set({ currentClient: null });
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
