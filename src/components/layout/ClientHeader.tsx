import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';

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

export default function ClientHeader() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentClient, toggleSettings } = useAppStore();

  if (!id) return null;

  const clientName = currentClient
    ? `${currentClient.firstName} ${currentClient.lastName}`.trim() || 'New Client'
    : 'Loading...';
  const age = currentClient ? getAge(currentClient.dateOfBirth) : null;

  const tabs = [
    { label: 'Setup', path: `/client/${id}/setup` },
    { label: 'Projections', path: `/client/${id}/projections` },
    { label: 'Insurance', path: `/client/${id}/insurance` },
    { label: 'Report', path: `/client/${id}/report` },
  ];

  const isActive = (tabPath: string) => location.pathname.startsWith(tabPath);

  return (
    <header className="bg-white border-b border-gray-200 no-print shrink-0">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Top row: branding + client name + actions */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
              title="Back to Dashboard"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium">Clients</span>
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <div>
              <span className="text-sm font-semibold text-text-primary">{clientName}</span>
              {age !== null && currentClient && (
                <span className="text-xs text-text-tertiary ml-2">
                  Age {age} &middot; {currentClient.province}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="text-xs text-text-tertiary hover:text-text-secondary px-2 py-1 rounded transition-colors"
            >
              Print
            </button>
            <button
              onClick={toggleSettings}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-gray-100 transition-all"
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6.5 1.5h3l.3 1.8a5.5 5.5 0 011.3.7l1.7-.7 1.5 2.6-1.4 1.1a5.5 5.5 0 010 1.5l1.4 1.1-1.5 2.6-1.7-.7a5.5 5.5 0 01-1.3.7l-.3 1.8h-3l-.3-1.8a5.5 5.5 0 01-1.3-.7l-1.7.7-1.5-2.6 1.4-1.1a5.5 5.5 0 010-1.5L1.7 5.9l1.5-2.6 1.7.7a5.5 5.5 0 011.3-.7L6.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab row */}
        <nav className="flex gap-1 -mb-px" aria-label="Client sections">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`
                  px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                  ${active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
