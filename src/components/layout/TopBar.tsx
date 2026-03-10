import { useAppStore } from '../../store';

export default function TopBar() {
  const { currentClient, toggleSettings } = useAppStore();

  const clientName = currentClient
    ? `${currentClient.firstName} ${currentClient.lastName}`.trim()
    : '';

  return (
    <header className="h-14 bg-navy flex items-center justify-between px-6 shrink-0 no-print border-b border-white/[0.06]">
      {/* Left: Brand mark */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-light to-accent flex items-center justify-center shadow-sm">
          <span className="text-white font-serif text-sm font-bold leading-none">M</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-[15px] text-white tracking-wide">
            Meridian
          </span>
          <span className="text-[11px] text-white/40 font-light tracking-widest uppercase">
            Financial Planning
          </span>
        </div>
      </div>

      {/* Center: Current client context */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 text-sm">
        {clientName && (
          <>
            <span className="text-white/90 font-medium tracking-wide">{clientName}</span>
            <span className="w-1 h-1 rounded-full bg-accent-light/60" />
            <span className="text-white/40 text-xs tracking-wider uppercase">Base Scenario</span>
          </>
        )}
      </div>

      {/* Right: Subtle settings */}
      <button
        onClick={toggleSettings}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all duration-200"
        aria-label="Settings"
      >
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
          <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M14.2 10.6a1.1 1.1 0 00.22 1.21l.04.04a1.33 1.33 0 11-1.88 1.88l-.04-.04a1.1 1.1 0 00-1.21-.22 1.1 1.1 0 00-.66 1v.1a1.33 1.33 0 11-2.66 0v-.05A1.1 1.1 0 007.4 14.2a1.1 1.1 0 00-1.21.22l-.04.04a1.33 1.33 0 11-1.88-1.88l.04-.04a1.1 1.1 0 00.22-1.21 1.1 1.1 0 00-1-.66h-.1a1.33 1.33 0 010-2.66h.05A1.1 1.1 0 003.8 7.4a1.1 1.1 0 00-.22-1.21l-.04-.04A1.33 1.33 0 115.42 4.27l.04.04a1.1 1.1 0 001.21.22h.05a1.1 1.1 0 00.66-1v-.1a1.33 1.33 0 012.66 0v.05a1.1 1.1 0 00.66 1 1.1 1.1 0 001.21-.22l.04-.04a1.33 1.33 0 111.88 1.88l-.04.04a1.1 1.1 0 00-.22 1.21v.05a1.1 1.1 0 001 .66h.1a1.33 1.33 0 110 2.66h-.05a1.1 1.1 0 00-1 .66z"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      </button>
    </header>
  );
}
