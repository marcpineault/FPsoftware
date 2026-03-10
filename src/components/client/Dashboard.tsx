import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store';
import { db } from '../../db';
import { createDefaultClient } from '../../lib/types';

function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function Dashboard() {
  const navigate = useNavigate();
  const { clients, loadClients, deleteClient, setCurrentClient, practiceSettings, toggleSettings } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    loadClients().finally(() => setIsLoading(false));
  }, [loadClients]);

  const handleNewClient = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const id = uuidv4();
      const newClient = createDefaultClient(id);
      newClient.province = (practiceSettings.defaultProvince || 'ON') as typeof newClient.province;
      newClient.projectionParams.rrspReturnRate = practiceSettings.defaultRrspReturn / 100;
      newClient.projectionParams.tfsaReturnRate = practiceSettings.defaultTfsaReturn / 100;
      newClient.projectionParams.nonRegReturnRate = practiceSettings.defaultNonRegReturn / 100;
      newClient.projectionParams.inflationRate = practiceSettings.defaultInflation / 100;
      await db.clients.put(newClient);
      setCurrentClient(newClient);
      navigate(`/client/${id}/setup/client`);
    } catch (err) {
      console.error('Failed to create client:', err);
      setIsCreating(false);
    }
  }, [isCreating, navigate, setCurrentClient, practiceSettings]);

  const handleDeleteClient = useCallback(
    async (e: React.MouseEvent, id: string, name: string) => {
      e.stopPropagation();
      const displayName = name.trim() || 'this unnamed client';
      if (!window.confirm(`Delete ${displayName}? This cannot be undone.`)) return;
      setDeletingId(id);
      try {
        await deleteClient(id);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteClient],
  );

  const handleExportAll = useCallback(() => {
    if (clients.length === 0) return;
    const data = { exportedAt: new Date().toISOString(), version: 1, clients };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meridian-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [clients]);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const importClients = data.clients ?? data;
        if (!Array.isArray(importClients)) {
          setImportStatus('Invalid file format');
          return;
        }
        let imported = 0;
        for (const c of importClients) {
          if (c.id && c.firstName !== undefined) {
            c.createdAt = new Date(c.createdAt);
            c.updatedAt = new Date(c.updatedAt);
            await db.clients.put(c);
            imported++;
          }
        }
        await loadClients();
        setImportStatus(`Imported ${imported} client${imported !== 1 ? 's' : ''}`);
        setTimeout(() => setImportStatus(null), 3000);
      } catch {
        setImportStatus('Failed to import');
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    input.click();
  }, [loadClients]);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Simple header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-serif text-sm font-bold">M</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                {practiceSettings.firmName || 'Meridian'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewClient}
              disabled={isCreating}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {isCreating ? 'Creating...' : 'New Client'}
            </button>
            <button
              onClick={toggleSettings}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-gray-100 transition-all"
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6.5 1.5h3l.3 1.8a5.5 5.5 0 011.3.7l1.7-.7 1.5 2.6-1.4 1.1a5.5 5.5 0 010 1.5l1.4 1.1-1.5 2.6-1.7-.7a5.5 5.5 0 01-1.3.7l-.3 1.8h-3l-.3-1.8a5.5 5.5 0 01-1.3-.7l-1.7.7-1.5-2.6 1.4-1.1a5.5 5.5 0 010-1.5L1.7 5.9l1.5-2.6 1.7.7a5.5 5.5 0 011.3-.7L6.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && clients.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-text-tertiary">
                <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 21c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary">No clients yet</h3>
            <p className="mt-2 text-sm text-text-secondary max-w-sm mx-auto">
              Create your first client to begin building their financial plan.
            </p>
            <button
              onClick={handleNewClient}
              disabled={isCreating}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Create First Client
            </button>
          </div>
        )}

        {/* Client table */}
        {!isLoading && clients.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {importStatus && (
              <div className="px-4 py-2 bg-green-50 text-green-700 text-sm border-b border-green-100">
                {importStatus}
              </div>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Province</th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Age</th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Last Updated</th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Unnamed Client';
                  const age = calculateAge(client.dateOfBirth);
                  const isDeleting = deletingId === client.id;

                  return (
                    <tr
                      key={client.id}
                      onClick={() => navigate(`/client/${client.id}/setup/client`)}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-text-primary">{fullName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-secondary">{client.province || '--'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-secondary tabular-nums">{age ?? '--'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-tertiary">{formatDate(client.updatedAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => handleDeleteClient(e, client.id, fullName)}
                          disabled={isDeleting}
                          className="text-xs text-text-tertiary hover:text-negative transition-colors px-2 py-1 rounded"
                          title="Delete"
                        >
                          {isDeleting ? '...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer links */}
        {!isLoading && (
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleImport}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Import
            </button>
            {clients.length > 0 && (
              <button
                onClick={handleExportAll}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Export Backup
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
