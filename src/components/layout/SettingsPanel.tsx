import { useAppStore } from '../../store';

export default function SettingsPanel() {
  const { practiceSettings, updatePracticeSettings, settingsOpen, toggleSettings } = useAppStore();

  if (!settingsOpen) return null;

  const inputClass =
    'w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={toggleSettings}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
          <h2 className="font-serif text-lg text-text-primary">Settings</h2>
          <button
            onClick={toggleSettings}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Practice Info */}
          <div>
            <h3 className="text-xs text-text-tertiary tracking-wider uppercase mb-3">Practice Info</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Firm Name</label>
                <input
                  type="text"
                  value={practiceSettings.firmName}
                  onChange={(e) => updatePracticeSettings({ firmName: e.target.value })}
                  className={inputClass}
                  placeholder="Your Firm Name"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Advisor Name</label>
                <input
                  type="text"
                  value={practiceSettings.advisorName}
                  onChange={(e) => updatePracticeSettings({ advisorName: e.target.value })}
                  className={inputClass}
                  placeholder="Your Name"
                />
              </div>
            </div>
          </div>

          {/* Default Assumptions */}
          <div>
            <h3 className="text-xs text-text-tertiary tracking-wider uppercase mb-3">Default Assumptions</h3>
            <p className="text-xs text-text-tertiary mb-3">
              Applied to new clients. Existing clients keep their current values.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">RRSP Return %</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    value={practiceSettings.defaultRrspReturn}
                    onChange={(e) => updatePracticeSettings({ defaultRrspReturn: parseFloat(e.target.value) || 4.5 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">TFSA Return %</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    value={practiceSettings.defaultTfsaReturn}
                    onChange={(e) => updatePracticeSettings({ defaultTfsaReturn: parseFloat(e.target.value) || 5.0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Non-Reg Return %</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    value={practiceSettings.defaultNonRegReturn}
                    onChange={(e) => updatePracticeSettings({ defaultNonRegReturn: parseFloat(e.target.value) || 4.0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Inflation %</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={5}
                    value={practiceSettings.defaultInflation}
                    onChange={(e) => updatePracticeSettings({ defaultInflation: parseFloat(e.target.value) || 2.0 })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="border-t border-card-border pt-4">
            <h3 className="text-xs text-text-tertiary tracking-wider uppercase mb-2">About</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Meridian Financial Planning Software v1.0<br />
              Canadian financial planning tool with retirement projections,
              tax optimization, insurance analysis, and scenario comparison.
            </p>
            <p className="text-xs text-text-tertiary mt-2">
              Data stored locally in your browser (IndexedDB). No data leaves your computer.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
