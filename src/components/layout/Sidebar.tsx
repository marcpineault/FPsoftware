import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../../store';

interface SidebarProps {
  clientId?: string;
}

interface NavItem {
  label: string;
  path: string;
  status: 'complete' | 'viewed' | 'not-visited';
}

function StatusIndicator({ status }: { status: NavItem['status'] }) {
  if (status === 'complete') {
    return (
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-positive text-white text-xs font-bold shrink-0">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (status === 'viewed') {
    return (
      <span className="flex items-center justify-center w-5 h-5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-accent-light" />
      </span>
    );
  }

  return (
    <span className="flex items-center justify-center w-5 h-5 shrink-0">
      <span className="w-2.5 h-2.5 rounded-full border-2 border-white/30" />
    </span>
  );
}

function getAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default function Sidebar({ clientId }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentClient, sidebarCollapsed, toggleSidebar } = useAppStore();

  const hasClient = !!(clientId && currentClient);

  const navItems: NavItem[] = hasClient
    ? [
        {
          label: 'Discovery',
          path: `/client/${clientId}/discovery`,
          status: currentClient!.discoveryComplete ? 'complete' : 'not-visited',
        },
        {
          label: 'Profile',
          path: `/client/${clientId}/profile`,
          status: currentClient!.profileComplete ? 'complete' : 'not-visited',
        },
        {
          label: 'Projections',
          path: `/client/${clientId}/projections`,
          status: currentClient!.projectionsViewed
            ? 'viewed'
            : 'not-visited',
        },
        {
          label: 'Summary',
          path: `/client/${clientId}/summary`,
          status: 'not-visited',
        },
      ]
    : [];

  const age = hasClient ? getAge(currentClient!.dateOfBirth) : null;
  const clientName = hasClient
    ? `${currentClient!.firstName} ${currentClient!.lastName}`.trim()
    : '';

  return (
    <aside
      className={`
        flex flex-col h-full bg-navy text-white transition-all duration-300 no-print shrink-0
        ${sidebarCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute top-4 right-0 translate-x-1/2 z-10 w-6 h-6 rounded-full bg-navy-light border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-navy-light transition-colors"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={`transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
        >
          <path d="M8.5 3.5L5 7L8.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Top section: client info or tool name */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        {hasClient && !sidebarCollapsed ? (
          <div>
            <p className="text-sm font-semibold text-white truncate">
              {clientName || 'Unnamed Client'}
            </p>
            {age !== null && (
              <p className="text-xs text-white/50 mt-0.5">Age {age}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {sidebarCollapsed ? (
              <span className="text-lg font-bold text-accent-light mx-auto">FP</span>
            ) : (
              <span className="text-sm font-bold tracking-wide text-white/90">Financial Planner</span>
            )}
          </div>
        )}
      </div>

      {/* Navigation links */}
      {hasClient && !sidebarCollapsed && (
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Module navigation">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
                  ${isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-light" />
                )}
                <StatusIndicator status={item.status} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Spacer when collapsed or no client */}
      {(!hasClient || sidebarCollapsed) && <div className="flex-1" />}

      {/* Quick actions */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {hasClient && !sidebarCollapsed && (
          <>
            <button
              onClick={() => {
                /* Save session handled by auto-save / store.updateClient */
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M13 14H3a1 1 0 01-1-1V3a1 1 0 011-1h7.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V13a1 1 0 01-1 1z" stroke="currentColor" strokeWidth="1.3" />
                <path d="M5 14V9h6v5M5 2v3h4" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              <span>Save session</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M4 6V2h8v4M4 12H2.5A1.5 1.5 0 011 10.5v-3A1.5 1.5 0 012.5 6h11A1.5 1.5 0 0115 7.5v3a1.5 1.5 0 01-1.5 1.5H12" stroke="currentColor" strokeWidth="1.3" />
                <rect x="4" y="10" width="8" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              <span>Export / Print</span>
            </button>
          </>
        )}

        <button
          onClick={() => navigate('/client/new')}
          className={`
            flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors
            ${sidebarCollapsed ? 'justify-center' : ''}
          `}
          title="New client"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 5.5v5M5.5 8h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {!sidebarCollapsed && <span>New client</span>}
        </button>

        <button
          onClick={() => navigate('/')}
          className={`
            flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors
            ${sidebarCollapsed ? 'justify-center' : ''}
          `}
          title="Back to dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <path d="M2 8.5l6-5.5 6 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.5 7.5V13a1 1 0 001 1h2.25V11h2.5v3h2.25a1 1 0 001-1V7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!sidebarCollapsed && <span>Dashboard</span>}
        </button>
      </div>
    </aside>
  );
}
