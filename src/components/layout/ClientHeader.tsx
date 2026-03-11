import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';

function getAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function getInitials(first: string, last: string): string {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '?';
}

export default function ClientHeader() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentClient, toggleSettings } = useAppStore();

  if (!id) return null;

  const firstName = currentClient?.firstName || '';
  const lastName = currentClient?.lastName || '';
  const clientName = `${firstName} ${lastName}`.trim() || 'New Client';
  const age = currentClient ? getAge(currentClient.dateOfBirth) : null;

  const tabs = [
    { label: 'Setup', path: `/client/${id}/setup`, icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 5.5h5M5 7.5h3.5M5 9.5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    )},
    { label: 'Projections', path: `/client/${id}/projections`, icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <polyline points="2,11 5,7 8,8.5 11,4 13,5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <line x1="2" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )},
    { label: 'Scenarios', path: `/client/${id}/scenarios`, icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1.5" y="4" width="4" height="9" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
        <rect x="5.5" y="2" width="4" height="11" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
        <rect x="9.5" y="6" width="4" height="7" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    )},
    { label: 'Insurance', path: `/client/${id}/insurance`, icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5L3 3.5v3.5c0 3 2 5 4.5 5.5 2.5-.5 4.5-2.5 4.5-5.5V3.5L7.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    )},
    { label: 'Report', path: `/client/${id}/report`, icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M4 1.5h4.5l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-10a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8.5 1.5v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )},
  ];

  const isActive = (tabPath: string) => location.pathname.startsWith(tabPath);

  return (
    <header className="no-print shrink-0 bg-white border-b border-gray-200">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Top row */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors group"
              title="Back to Dashboard"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-medium hidden sm:inline">Dashboard</span>
            </button>

            <div className="w-px h-5 bg-gray-200" />

            {/* Client avatar + name */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{getInitials(firstName, lastName)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-slate-800">{clientName}</span>
                {age !== null && currentClient && (
                  <span className="text-xs text-slate-400">
                    {age}y &middot; {currentClient.province}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => window.print()}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              Print
            </button>
            <button
              onClick={toggleSettings}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-colors"
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6.5 1.5h3l.3 1.5a5 5 0 011.2.7l1.4-.6 1.5 2.6-1.1.9a5 5 0 010 1.4l1.1.9-1.5 2.6-1.4-.6a5 5 0 01-1.2.7l-.3 1.5h-3l-.3-1.5a5 5 0 01-1.2-.7l-1.4.6-1.5-2.6 1.1-.9a5 5 0 010-1.4l-1.1-.9 1.5-2.6 1.4.6a5 5 0 011.2-.7l.3-1.5z" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab row */}
        <nav className="flex gap-0.5 -mb-px" aria-label="Client sections">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`
                  relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors
                  ${active
                    ? 'text-amber-600'
                    : 'text-slate-400 hover:text-slate-600'
                  }
                `}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
