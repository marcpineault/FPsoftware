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
    <header className="no-print shrink-0" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Top row */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
              title="Back to Dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
                <path d="M11 5L7 9L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="w-px h-6 bg-slate-700" />

            {/* Client avatar + name */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                <span className="text-[11px] font-bold text-white">{getInitials(firstName, lastName)}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-white">{clientName}</span>
                {age !== null && currentClient && (
                  <span className="text-xs text-slate-500 ml-2">
                    {age}y &middot; {currentClient.province}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-md hover:bg-white/5 transition-all"
            >
              Print
            </button>
            <button
              onClick={toggleSettings}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
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
        <nav className="flex gap-1" aria-label="Client sections">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all
                  ${active
                    ? 'bg-gray-50 text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }
                `}
              >
                <span className={active ? 'text-amber-500' : ''}>{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
