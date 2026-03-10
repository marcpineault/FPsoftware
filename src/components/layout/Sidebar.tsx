import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../../store';

interface SidebarProps {
  clientId?: string;
}

interface NavItem {
  label: string;
  path: string;
  status: 'complete' | 'viewed' | 'not-visited';
  icon: React.ReactNode;
}

function StatusDot({ status }: { status: NavItem['status'] }) {
  if (status === 'complete') {
    return (
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-positive/20 text-positive shrink-0">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === 'viewed') {
    return (
      <span className="flex items-center justify-center w-5 h-5 shrink-0">
        <span className="w-2 h-2 rounded-full bg-accent-light" />
      </span>
    );
  }
  return (
    <span className="flex items-center justify-center w-5 h-5 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
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
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          ),
        },
        {
          label: 'Profile',
          path: `/client/${clientId}/profile`,
          status: currentClient!.profileComplete ? 'complete' : 'not-visited',
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          ),
        },
        {
          label: 'Projections',
          path: `/client/${clientId}/projections`,
          status: currentClient!.projectionsViewed ? 'viewed' : 'not-visited',
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <polyline points="2,12 5,7 8,9 11,4 14,6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          ),
        },
        {
          label: 'Scenarios',
          path: `/client/${clientId}/scenarios`,
          status: 'not-visited',
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 6h1M4 8h1M4 10h1M11 6h1M11 8h1M11 10h1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          ),
        },
        {
          label: 'Insurance Analysis',
          path: `/client/${clientId}/insurance`,
          status: 'not-visited',
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L3 4.5v4c0 3.5 2.5 5.5 5 6.5 2.5-1 5-3 5-6.5v-4L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M6 8l1.5 1.5L10 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ),
        },
        {
          label: 'Summary',
          path: `/client/${clientId}/summary`,
          status: 'not-visited',
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 5h4M6 7.5h4M6 10h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          ),
        },
        {
          label: 'Plan Report',
          path: `/client/${clientId}/report`,
          status: 'not-visited',
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 8h4M6 10.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          ),
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
        sidebar-bg flex flex-col h-full text-white transition-all duration-300 no-print shrink-0 relative
        ${sidebarCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute top-4 right-0 translate-x-1/2 z-10 w-6 h-6 rounded-full bg-navy-light border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/80 hover:border-white/20 transition-all duration-200"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}
        >
          <path d="M7.5 3L4.5 6L7.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Client info or brand */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
        {hasClient && !sidebarCollapsed ? (
          <div>
            <p className="font-serif text-[15px] text-white tracking-wide truncate">
              {clientName || 'New Client'}
            </p>
            {age !== null && (
              <p className="text-[11px] text-white/40 mt-0.5 tracking-wider uppercase">
                Age {age} &middot; {currentClient!.province}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            {sidebarCollapsed ? (
              <span className="font-serif text-lg text-accent-light">M</span>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif text-[15px] text-white">Meridian</span>
                <span className="text-[10px] text-white/30 tracking-widest uppercase">FP</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflow hint */}
      {hasClient && !sidebarCollapsed && (
        <div className="px-4 py-2">
          <p className="text-[10px] text-white/25 tracking-wider uppercase">Workflow</p>
        </div>
      )}

      {/* Navigation links */}
      {hasClient && !sidebarCollapsed && (
        <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto" aria-label="Module navigation">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 relative
                  ${isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                  }
                `}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-accent-light" />
                )}
                <span className={`shrink-0 ${isActive ? 'text-accent-light' : 'text-white/30 group-hover:text-white/50'}`}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                <StatusDot status={item.status} />
              </Link>
            );
          })}
        </nav>
      )}

      {(!hasClient || sidebarCollapsed) && <div className="flex-1" />}

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-white/[0.06] space-y-0.5">
        {hasClient && !sidebarCollapsed && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] text-white/35 hover:bg-white/[0.04] hover:text-white/60 transition-all duration-150"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
              <path d="M4 5.5V1.5h7v4M4 11H2.75A1.25 1.25 0 011.5 9.75v-2.5A1.25 1.25 0 012.75 6h9.5a1.25 1.25 0 011.25 1.25v2.5A1.25 1.25 0 0112.25 11H11" stroke="currentColor" strokeWidth="1.1" />
              <rect x="4" y="9" width="7" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            <span>Export / Print</span>
          </button>
        )}

        <button
          onClick={() => navigate('/')}
          className={`
            flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] text-white/35 hover:bg-white/[0.04] hover:text-white/60 transition-all duration-150
            ${sidebarCollapsed ? 'justify-center' : ''}
          `}
          title="Dashboard"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
            <path d="M2 7.25l5.5-5 5.5 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.5 6.5v5.5a1 1 0 001 1h2v-3h2v3h2a1 1 0 001-1V6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!sidebarCollapsed && <span>Dashboard</span>}
        </button>
      </div>
    </aside>
  );
}
