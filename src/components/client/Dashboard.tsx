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

export function Dashboard() {
  const navigate = useNavigate();
  const { clients, loadClients, deleteClient } = useAppStore();
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
      navigate(`/client/${id}/discovery`);
    } catch (err) {
      console.error('Failed to create client:', err);
      setIsCreating(false);
    }
  }, [isCreating, navigate]);

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Header */}
      <header className="bg-navy shadow-md">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Financial Planning Tool
          </h1>
          <p className="mt-1 text-base text-white/70">Client Dashboard</p>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Toolbar */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {isLoading
              ? 'Loading clients...'
              : `${clients.length} ${clients.length === 1 ? 'Client' : 'Clients'}`}
          </h2>
          <button
            onClick={handleNewClient}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            {isCreating ? 'Creating...' : 'New Client'}
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && clients.length === 0 && (
          <div className="rounded-lg border border-card-border bg-white px-6 py-16 text-center shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-12 w-12 text-text-secondary/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-text-primary">
              No clients yet
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
              Get started by creating your first client. You'll walk through
              discovery, build their financial profile, and generate retirement
              projections.
            </p>
            <button
              onClick={handleNewClient}
              disabled={isCreating}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              {isCreating ? 'Creating...' : 'Create Your First Client'}
            </button>
          </div>
        )}

        {/* Client cards grid */}
        {!isLoading && clients.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => {
              const fullName =
                [client.firstName, client.lastName].filter(Boolean).join(' ') ||
                'Unnamed Client';
              const age = calculateAge(client.dateOfBirth);
              const isDeleting = deletingId === client.id;

              return (
                <div
                  key={client.id}
                  className="group relative rounded-lg border border-card-border bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Clickable card body */}
                  <button
                    type="button"
                    onClick={() => handleResumeClient(client.id)}
                    className="block w-full cursor-pointer p-5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent rounded-lg"
                  >
                    {/* Name & age row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-text-primary">
                          {fullName}
                        </h3>
                        {age !== null && (
                          <p className="mt-0.5 text-sm text-text-secondary">
                            Age {age}
                          </p>
                        )}
                      </div>
                      {/* Resume chevron */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="mt-1 h-5 w-5 flex-shrink-0 text-text-secondary/40 transition-colors group-hover:text-accent"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>

                    {/* Last updated */}
                    <p className="mt-3 text-xs text-text-secondary">
                      Last session:{' '}
                      <span className="font-medium">
                        {formatDate(client.updatedAt)}
                      </span>
                    </p>

                    {/* Completion badges */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <CompletionBadge
                        label="Discovery"
                        complete={client.discoveryComplete}
                      />
                      <CompletionBadge
                        label="Profile"
                        complete={client.profileComplete}
                      />
                      <CompletionBadge
                        label="Projections"
                        complete={client.projectionsViewed}
                      />
                    </div>
                  </button>

                  {/* Delete button – floats top-right corner, stops propagation */}
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
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
                      className="rounded p-1.5 text-text-secondary/50 transition-colors hover:bg-red-50 hover:text-negative focus:outline-none focus:ring-2 focus:ring-negative disabled:opacity-50"
                      title="Delete client"
                    >
                      {isDeleting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-negative border-t-transparent" />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CompletionBadge({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        complete
          ? 'bg-positive/10 text-positive'
          : 'bg-bg-secondary text-text-secondary'
      }`}
    >
      {complete ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {label}
    </span>
  );
}
