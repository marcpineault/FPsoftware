import { create } from 'zustand';
import type { Client } from '../lib/types';
import { db } from '../db';

export interface PracticeSettings {
  firmName: string;
  advisorName: string;
  defaultProvince: string;
  defaultRrspReturn: number;
  defaultTfsaReturn: number;
  defaultNonRegReturn: number;
  defaultInflation: number;
}

const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  firmName: 'Meridian Financial Planning',
  advisorName: '',
  defaultProvince: 'ON',
  defaultRrspReturn: 4.5,
  defaultTfsaReturn: 5.0,
  defaultNonRegReturn: 4.0,
  defaultInflation: 2.0,
};

function loadPracticeSettings(): PracticeSettings {
  try {
    const stored = localStorage.getItem('meridian-practice-settings');
    if (stored) return { ...DEFAULT_PRACTICE_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PRACTICE_SETTINGS };
}

function savePracticeSettings(settings: PracticeSettings) {
  localStorage.setItem('meridian-practice-settings', JSON.stringify(settings));
}

interface AppState {
  currentClient: Client | null;
  clients: Client[];
  sidebarCollapsed: boolean;
  practiceSettings: PracticeSettings;
  settingsOpen: boolean;

  setCurrentClient: (client: Client | null) => void;
  updateClient: (updates: Partial<Client>) => Promise<void>;
  loadClients: () => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  toggleSidebar: () => void;
  updatePracticeSettings: (updates: Partial<PracticeSettings>) => void;
  toggleSettings: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentClient: null,
  clients: [],
  sidebarCollapsed: false,
  practiceSettings: loadPracticeSettings(),
  settingsOpen: false,

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

  updatePracticeSettings: (updates) => {
    const current = get().practiceSettings;
    const updated = { ...current, ...updates };
    savePracticeSettings(updated);
    set({ practiceSettings: updated });
  },

  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
}));
