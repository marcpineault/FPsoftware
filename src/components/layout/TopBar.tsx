import { useAppStore } from '../../store';

export default function TopBar() {
  const { currentClient } = useAppStore();

  const clientName = currentClient
    ? `${currentClient.firstName} ${currentClient.lastName}`.trim()
    : '';

  return (
    <header className="h-14 bg-navy flex items-center justify-between px-5 shrink-0 no-print border-b border-navy-dark">
      {/* Left: Tool name / logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-accent-light flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 13V5l3-3h6l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1z"
              stroke="white"
              strokeWidth="1.4"
            />
            <path d="M5 9h6M5 11.5h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-white tracking-wide">
          Financial Planning Tool
        </span>
      </div>

      {/* Center: Current client + scenario */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-sm">
        {clientName && (
          <>
            <span className="text-white/80 font-medium">{clientName}</span>
            <span className="text-white/30">&middot;</span>
            <span className="text-white/50">Base Scenario</span>
          </>
        )}
      </div>

      {/* Right: Settings placeholder */}
      <button
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M14.7 11.1a1.2 1.2 0 00.24 1.32l.04.04a1.455 1.455 0 11-2.058 2.058l-.04-.04a1.2 1.2 0 00-1.32-.24 1.2 1.2 0 00-.726 1.098v.114a1.455 1.455 0 11-2.91 0v-.06A1.2 1.2 0 007.1 14.7a1.2 1.2 0 00-1.32.24l-.04.04a1.455 1.455 0 11-2.058-2.058l.04-.04a1.2 1.2 0 00.24-1.32 1.2 1.2 0 00-1.098-.726H2.75a1.455 1.455 0 010-2.91h.06A1.2 1.2 0 003.5 7.1a1.2 1.2 0 00-.24-1.32l-.04-.04A1.455 1.455 0 115.278 3.68l.04.04a1.2 1.2 0 001.32.24h.06a1.2 1.2 0 00.726-1.098V2.75a1.455 1.455 0 012.91 0v.06a1.2 1.2 0 00.726 1.098 1.2 1.2 0 001.32-.24l.04-.04a1.455 1.455 0 112.058 2.058l-.04.04a1.2 1.2 0 00-.24 1.32v.06a1.2 1.2 0 001.098.726h.114a1.455 1.455 0 110 2.91h-.06a1.2 1.2 0 00-1.098.726z"
            stroke="currentColor"
            strokeWidth="1.1"
          />
        </svg>
      </button>
    </header>
  );
}
