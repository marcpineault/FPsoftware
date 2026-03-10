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
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(n: number): string {
  if (!n) return '--';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function Dashboard() {
  const navigate = useNavigate();
  const { clients, loadClients, deleteClient, setCurrentClient } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadClients().finally(() => setIsLoading(false));
  }, [loadClients]);

  const handleNewClient = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const id = uuidv4();
      const newClient = createDefaultClient(id);
      await db.clients.put(newClient);
      setCurrentClient(newClient);
      navigate(`/client/${id}/discovery`);
    } catch (err) {
      console.error('Failed to create client:', err);
      setIsCreating(false);
    }
  }, [isCreating, navigate, setCurrentClient]);

  const handleDeleteClient = useCallback(
    async (id: string, name: string) => {
      const displayName = name.trim() || 'this unnamed client';
      const confirmed = window.confirm(
        `Are you sure you want to delete ${displayName}? This action cannot be undone.`
      );
      if (!confirmed) return;

      setDeletingId(id);
      try {
        await deleteClient(id);
      } catch (err) {
        console.error('Failed to delete client:', err);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteClient]
  );

  const handleResumeClient = useCallback(
    (id: string) => {
      navigate(`/client/${id}/discovery`);
    },
    [navigate]
  );

  const completedPlans = clients.filter(c => c.projectionsViewed).length;
  const totalAssets = clients.reduce((sum, c) =>
    sum + (c.rrspBalance || 0) + (c.tfsaBalance || 0) + (c.nonRegisteredInvestments || 0), 0
  );

  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Hero header */}
      <header className="bg-navy relative overflow-hidden">
        {/* Subtle texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(184,134,11,0.06)_0%,transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-light to-accent flex items-center justify-center shadow-lg shadow-accent/20">
                  <span className="text-white font-serif text-lg font-bold leading-none">M</span>
                </div>
                <span className="text-[11px] text-white/30 tracking-[0.2em] uppercase">Meridian Financial Planning</span>
              </div>
              <h1 className="font-serif text-3xl text-white tracking-wide">
                Client Dashboard
              </h1>
              <p className="mt-2 text-sm text-white/50 font-light">
                {new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Quick stats */}
            {clients.length > 0 && (
              <div className="hidden sm:flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[11px] text-white/30 tracking-wider uppercase">Clients</p>
                  <p className="font-serif text-2xl text-white mt-0.5">{clients.length}</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-right">
                  <p className="text-[11px] text-white/30 tracking-wider uppercase">Plans Complete</p>
                  <p className="font-serif text-2xl text-white mt-0.5">{completedPlans}</p>
                </div>
                {totalAssets > 0 && (
                  <>
                    <div className="w-px h-10 bg-white/10" />
                    <div className="text-right">
                      <p className="text-[11px] text-white/30 tracking-wider uppercase">AUM</p>
                      <p className="font-serif text-2xl text-white mt-0.5">{formatCurrency(totalAssets)}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-secondary tracking-wider uppercase">
            {isLoading ? 'Loading...' : `${clients.length} ${clients.length === 1 ? 'Client' : 'Clients'}`}
          </h2>
          <button
            onClick={handleNewClient}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-accent-hover hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {isCreating ? 'Creating...' : 'New Client'}
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && clients.length === 0 && (
          <div className="animate-card-enter rounded-xl border border-card-border bg-card-bg px-6 py-20 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-bg-secondary flex items-center justify-center mb-5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-text-tertiary">
                <circle cx="14" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 26c0-5 4-9 9-9s9 4 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="font-serif text-xl text-text-primary">
              Welcome to Meridian
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-text-secondary leading-relaxed">
              Begin by creating your first client. You'll walk through discovery, build their financial
              profile, generate retirement projections, and deliver a comprehensive plan.
            </p>
            <button
              onClick={handleNewClient}
              disabled={isCreating}
              className="mt-8 inline-flex items-center gap-2.5 rounded-lg bg-accent px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {isCreating ? 'Creating...' : 'Create Your First Client'}
            </button>
          </div>
        )}

        {/* Client cards */}
        {!isLoading && clients.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {clients.map((client) => {
              const fullName =
                [client.firstName, client.lastName].filter(Boolean).join(' ') ||
                'Unnamed Client';
              const age = calculateAge(client.dateOfBirth);
              const isDeleting = deletingId === client.id;
              const totalSavings = (client.rrspBalance || 0) + (client.tfsaBalance || 0) + (client.nonRegisteredInvestments || 0);
              const completedModules = [client.discoveryComplete, client.profileComplete, client.projectionsViewed].filter(Boolean).length;

              return (
                <div
                  key={client.id}
                  className="group relative rounded-xl border border-card-border bg-card-bg shadow-sm transition-all duration-200 hover:shadow-md hover:border-card-border-hover"
                >
                  <button
                    type="button"
                    onClick={() => handleResumeClient(client.id)}
                    className="block w-full cursor-pointer p-5 text-left focus:outline-none rounded-xl"
                  >
                    {/* Name row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-serif text-lg text-text-primary truncate tracking-wide">
                          {fullName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {age !== null && (
                            <span className="text-xs text-text-tertiary">Age {age}</span>
                          )}
                          {age !== null && client.province && (
                            <span className="text-xs text-text-tertiary/40">&middot;</span>
                          )}
                          {client.province && (
                            <span className="text-xs text-text-tertiary">{client.province}</span>
                          )}
                        </div>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="mt-1.5 shrink-0 text-text-tertiary/40 transition-all duration-200 group-hover:text-accent group-hover:translate-x-0.5"
                      >
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Financial summary */}
                    {totalSavings > 0 && (
                      <div className="mt-4 pt-3 border-t border-card-border/60">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-text-tertiary tracking-wider uppercase">Total Savings</span>
                          <span className="tabular-nums text-sm font-medium text-text-primary">{formatCurrency(totalSavings)}</span>
                        </div>
                      </div>
                    )}

                    {/* Footer: date + badges */}
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-[11px] text-text-tertiary">
                        {formatDate(client.updatedAt)}
                      </p>
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              i < completedModules ? 'bg-positive' : 'bg-card-border'
                            }`}
                          />
                        ))}
                        <span className="text-[10px] text-text-tertiary ml-1">{completedModules}/3</span>
                      </div>
                    </div>
                  </button>

                  {/* Delete button */}
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(
                          client.id,
                          `${client.firstName} ${client.lastName}`
                        );
                      }}
                      disabled={isDeleting}
                      className="rounded-lg p-1.5 text-text-tertiary/50 transition-all duration-150 hover:bg-negative/10 hover:text-negative"
                      title="Delete client"
                    >
                      {isDeleting ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-negative border-t-transparent" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 4h9M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1m1.5 0v7a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 11V4h7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
