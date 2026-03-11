import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store';
import { db } from '../../db';
import { createDefaultClient } from '../../lib/types';
import { ConfirmDialog } from '../shared/ConfirmDialog';

function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(n: number): string {
  if (!n) return '--';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function getInitials(first: string, last: string): string {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '?';
}

export function Dashboard() {
  const navigate = useNavigate();
  const { clients, loadClients, deleteClient, setCurrentClient, practiceSettings, toggleSettings } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  const confirmDeleteClient = useCallback(async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      await deleteClient(deleteTarget.id);
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, deleteClient]);

  const handleExportAll = useCallback(() => {
    if (clients.length === 0) return;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, clients }, null, 2)], { type: 'application/json' });
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
        const data = JSON.parse(await file.text());
        const arr = data.clients ?? data;
        if (!Array.isArray(arr)) { setImportStatus('Invalid file'); return; }
        let n = 0;
        for (const c of arr) {
          if (c.id && c.firstName !== undefined) {
            c.createdAt = new Date(c.createdAt);
            c.updatedAt = new Date(c.updatedAt);
            await db.clients.put(c);
            n++;
          }
        }
        await loadClients();
        setImportStatus(`Imported ${n} client${n !== 1 ? 's' : ''}`);
        setTimeout(() => setImportStatus(null), 3000);
      } catch { setImportStatus('Failed to import'); setTimeout(() => setImportStatus(null), 3000); }
    };
    input.click();
  }, [loadClients]);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-serif text-lg font-bold">M</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800 tracking-tight">
                {practiceSettings.firmName || 'Meridian'}
              </h1>
              <p className="text-xs text-slate-400">
                {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleNewClient}
              disabled={isCreating}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {isCreating ? 'Creating...' : 'New Client'}
            </button>
            <button
              onClick={toggleSettings}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-colors"
              aria-label="Settings"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M7.5 1.5h3l.3 1.8a6 6 0 011.4.8l1.7-.7 1.5 2.6-1.4 1.1a6 6 0 010 1.6l1.4 1.1-1.5 2.6-1.7-.7a6 6 0 01-1.4.8l-.3 1.8h-3l-.3-1.8a6 6 0 01-1.4-.8l-1.7.7-1.5-2.6 1.4-1.1a6 6 0 010-1.6L2.2 5.8l1.5-2.6 1.7.7a6 6 0 011.4-.8L7.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <circle cx="9" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 sm:px-8 py-8">
        {importStatus && (
          <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm font-medium">
            {importStatus}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && clients.length === 0 && (
          <div className="rounded-2xl bg-white border border-gray-200 px-8 py-20 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-amber-500">
                <circle cx="14" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 26c0-5 4-9 9-9s9 4 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-800">Welcome to Meridian</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Create your first client to get started with comprehensive financial planning.
            </p>
            <button
              onClick={handleNewClient}
              disabled={isCreating}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Create First Client
            </button>
          </div>
        )}

        {/* Client list */}
        {!isLoading && clients.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                {clients.length} {clients.length === 1 ? 'Client' : 'Clients'}
              </h2>
              <div className="flex items-center gap-3">
                <button onClick={() => navigate('/tools')} className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors">
                  Quick Calculators
                </button>
                <span className="w-px h-3 bg-gray-200" />
                <button onClick={handleImport} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                  Import
                </button>
                <button onClick={handleExportAll} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                  Export
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden stagger-children">
              {clients.map((client) => {
                const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Unnamed Client';
                const age = calculateAge(client.dateOfBirth);
                const isDeleting = deletingId === client.id;
                const totalSavings = (client.rrspBalance || 0) + (client.tfsaBalance || 0) + (client.nonRegisteredInvestments || 0);
                const progress = [client.discoveryComplete, client.profileComplete, client.projectionsViewed].filter(Boolean).length;

                return (
                  <div
                    key={client.id}
                    onClick={() => navigate(`/client/${client.id}/setup/client`)}
                    className="group flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0 border border-slate-200">
                      <span className="text-sm font-semibold text-slate-500">{getInitials(client.firstName, client.lastName)}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold text-slate-800 truncate">{fullName}</h3>
                        {age !== null && (
                          <span className="text-xs text-slate-400 shrink-0">Age {age}</span>
                        )}
                        {client.province && (
                          <span className="text-xs text-slate-400 shrink-0">{client.province}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {client.annualIncome > 0 && (
                          <span className="text-xs text-slate-400 tabular-nums">Income {formatCurrency(client.annualIncome)}</span>
                        )}
                        {totalSavings > 0 && (
                          <>
                            {client.annualIncome > 0 && <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />}
                            <span className="text-xs text-slate-400 tabular-nums">Savings {formatCurrency(totalSavings)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Progress */}
                      <div className="flex items-center gap-1" title={`${progress} of 3 steps complete`}>
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${i < progress ? 'bg-emerald-400' : 'bg-gray-200'}`}
                          />
                        ))}
                      </div>

                      <span className="text-xs text-slate-400 tabular-nums hidden sm:inline">{formatDate(client.updatedAt)}</span>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: client.id, name: fullName });
                        }}
                        disabled={isDeleting}
                        className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Delete"
                      >
                        {isDeleting ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 4h9M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1m1.5 0v7a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 11V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      {/* Arrow */}
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Client"
        message={`Are you sure you want to delete ${deleteTarget?.name || 'this client'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={confirmDeleteClient}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
