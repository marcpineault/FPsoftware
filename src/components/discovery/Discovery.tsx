import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { PRIORITY_CATEGORIES } from '../../lib/constants';
import type { PriorityCategory } from '../../lib/types';

// ── Icon helpers ──────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── Category card icons ───────────────────────────────────────

const CATEGORY_ICONS: Record<string, ReactElement> = {
  'Estate Planning': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21" />
    </svg>
  ),
  'Retirement': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  'Income Protection': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  'Assisting Children': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
    </svg>
  ),
  'Assisting Parents': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  'Other': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ── Main component ────────────────────────────────────────────

export function Discovery() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentClient, updateClient } = useAppStore();

  // Local state: map from category name -> selected items set
  const [selectedItems, setSelectedItems] = useState<Record<string, Set<string>>>({});
  // Local state: notes per category
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Local state: "Other" free-text items
  const [otherInput, setOtherInput] = useState('');
  // Local state: custom items added under "Other"
  const [otherItems, setOtherItems] = useState<string[]>([]);
  // Priority ranking (category names in order)
  const [priorityRanking, setPriorityRanking] = useState<string[]>([]);

  // ── Load saved data on mount ────────────────────────────────

  useEffect(() => {
    if (!currentClient) return;

    const itemsMap: Record<string, Set<string>> = {};
    const notesMap: Record<string, string> = {};

    for (const cat of PRIORITY_CATEGORIES) {
      itemsMap[cat.name] = new Set<string>();
      notesMap[cat.name] = '';
    }

    // Restore from saved priorities
    if (currentClient.priorities && currentClient.priorities.length > 0) {
      for (const saved of currentClient.priorities) {
        if (saved.category === 'Other') {
          const customItems = saved.items || [];
          itemsMap['Other'] = new Set(customItems);
          setOtherItems(customItems);
        } else {
          itemsMap[saved.category] = new Set(saved.items);
        }
        notesMap[saved.category] = saved.notes || '';
      }
    }

    setSelectedItems(itemsMap);
    setNotes(notesMap);

    if (currentClient.priorityRanking && currentClient.priorityRanking.length > 0) {
      setPriorityRanking(currentClient.priorityRanking);
    }
  }, [currentClient]);

  // ── Persist to store ────────────────────────────────────────

  const persist = useCallback(
    (
      updatedItems: Record<string, Set<string>>,
      updatedNotes: Record<string, string>,
      updatedRanking: string[],
    ) => {
      const priorities: PriorityCategory[] = PRIORITY_CATEGORIES.map((cat) => ({
        category: cat.name,
        items: Array.from(updatedItems[cat.name] || []),
        notes: updatedNotes[cat.name] || '',
      }));
      void updateClient({ priorities, priorityRanking: updatedRanking });
    },
    [updateClient],
  );

  // ── Toggle a chip on/off ────────────────────────────────────

  const toggleItem = useCallback(
    (category: string, item: string) => {
      setSelectedItems((prev) => {
        const set = new Set(prev[category] || []);
        if (set.has(item)) {
          set.delete(item);
        } else {
          set.add(item);
        }
        const next = { ...prev, [category]: set };

        // Update ranking: add category if it now has selections, remove if empty
        setPriorityRanking((prevRanking) => {
          let newRanking = [...prevRanking];
          const hasSelections = set.size > 0;
          const inRanking = newRanking.includes(category);

          if (hasSelections && !inRanking) {
            newRanking.push(category);
          } else if (!hasSelections && inRanking) {
            newRanking = newRanking.filter((c) => c !== category);
          }

          persist(next, notes, newRanking);
          return newRanking;
        });

        return next;
      });
    },
    [notes, persist],
  );

  // ── Update notes for a category ─────────────────────────────

  const updateNotes = useCallback(
    (category: string, value: string) => {
      setNotes((prev) => {
        const next = { ...prev, [category]: value };
        persist(selectedItems, next, priorityRanking);
        return next;
      });
    },
    [selectedItems, priorityRanking, persist],
  );

  // ── Add custom "Other" items ────────────────────────────────

  const addOtherItem = useCallback(() => {
    const trimmed = otherInput.trim();
    if (!trimmed) return;

    setOtherItems((prev) => {
      const next = [...prev, trimmed];
      setSelectedItems((prevItems) => {
        const set = new Set(next);
        const nextItems = { ...prevItems, Other: set };

        setPriorityRanking((prevRanking) => {
          let newRanking = [...prevRanking];
          if (!newRanking.includes('Other')) {
            newRanking.push('Other');
          }
          persist(nextItems, notes, newRanking);
          return newRanking;
        });

        return nextItems;
      });
      return next;
    });
    setOtherInput('');
  }, [otherInput, notes, persist]);

  const removeOtherItem = useCallback(
    (item: string) => {
      setOtherItems((prev) => {
        const next = prev.filter((i) => i !== item);
        setSelectedItems((prevItems) => {
          const set = new Set(next);
          const nextItems = { ...prevItems, Other: set };

          setPriorityRanking((prevRanking) => {
            let newRanking = [...prevRanking];
            if (next.length === 0) {
              newRanking = newRanking.filter((c) => c !== 'Other');
            }
            persist(nextItems, notes, newRanking);
            return newRanking;
          });

          return nextItems;
        });
        return next;
      });
    },
    [notes, persist],
  );

  // ── Move a category up/down in ranking ──────────────────────

  const moveRanking = useCallback(
    (index: number, direction: 'up' | 'down') => {
      setPriorityRanking((prev) => {
        const next = [...prev];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= next.length) return prev;
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        persist(selectedItems, notes, next);
        return next;
      });
    },
    [selectedItems, notes, persist],
  );

  // ── Navigate to next step ───────────────────────────────────

  const handleNext = useCallback(() => {
    void updateClient({ discoveryComplete: true });
    navigate(`/client/${id}/profile`);
  }, [id, navigate, updateClient]);

  // ── Derived values ──────────────────────────────────────────

  const getSelectedCount = (categoryName: string): number => {
    return selectedItems[categoryName]?.size ?? 0;
  };

  const totalSelected = Object.values(selectedItems).reduce((sum, set) => sum + set.size, 0);

  // ── Render ──────────────────────────────────────────────────

  if (!currentClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">Loading client data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-navy tracking-wide">Discovery &amp; Priorities</h1>
        <p className="mt-1 text-text-secondary">
          Identify what matters most to{' '}
          <span className="font-medium text-text-primary">
            {currentClient.firstName || 'the client'}
          </span>
          . Select relevant topics within each category, then rank the categories by importance.
        </p>
      </div>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {PRIORITY_CATEGORIES.map((cat) => {
          const count = getSelectedCount(cat.name);
          const isOther = cat.name === 'Other';

          return (
            <div
              key={cat.name}
              className={`bg-white rounded-lg border shadow-sm p-5 transition-colors ${
                count > 0 ? 'border-accent/40' : 'border-card-border'
              }`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-lg ${
                      count > 0
                        ? 'bg-accent/10 text-accent'
                        : 'bg-bg-secondary text-text-secondary'
                    }`}
                  >
                    {CATEGORY_ICONS[cat.name]}
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">{cat.name}</h2>
                </div>
                {count > 0 && (
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    {count} selected
                  </span>
                )}
              </div>

              {/* Chips for predefined items */}
              {!isOther && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {cat.items.map((item) => {
                    const selected = selectedItems[cat.name]?.has(item) ?? false;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleItem(cat.name, item)}
                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-all cursor-pointer select-none ${
                          selected
                            ? 'bg-accent text-white shadow-sm'
                            : 'border border-card-border bg-white text-text-primary hover:border-accent hover:text-accent'
                        }`}
                      >
                        {selected && <CheckIcon />}
                        {item}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* "Other" category: free-text input */}
              {isOther && (
                <div className="mb-3">
                  {/* Display existing custom items as removable chips */}
                  {otherItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {otherItems.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-full bg-accent text-white px-3 py-1.5 text-sm font-medium"
                        >
                          <CheckIcon />
                          {item}
                          <button
                            type="button"
                            onClick={() => removeOtherItem(item)}
                            className="ml-1.5 hover:text-white/70 transition-colors"
                            aria-label={`Remove ${item}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Input + add button */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otherInput}
                      onChange={(e) => setOtherInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOtherItem();
                        }
                      }}
                      placeholder="Type a custom priority and press Enter..."
                      className="flex-1 rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={addOtherItem}
                      disabled={!otherInput.trim()}
                      className="inline-flex items-center justify-center rounded-lg bg-accent text-white px-3 py-2 text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Notes textarea */}
              <textarea
                value={notes[cat.name] || ''}
                onChange={(e) => updateNotes(cat.name, e.target.value)}
                placeholder="Advisor notes..."
                rows={2}
                className="w-full rounded-lg border border-card-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none resize-none transition-colors"
              />
            </div>
          );
        })}
      </div>

      {/* Priority Ranking section */}
      {priorityRanking.length > 0 && (
        <div className="mt-8">
          <div className="bg-white rounded-lg border border-card-border shadow-sm p-6">
            <div className="flex items-center gap-2.5 mb-1">
              <svg className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              <h2 className="font-serif text-lg text-navy tracking-wide">Priority Ranking</h2>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Use the arrows to reorder categories by importance. The highest priority should be at the top.
            </p>

            <div className="space-y-2">
              {priorityRanking.map((categoryName, index) => {
                const count = getSelectedCount(categoryName);
                return (
                  <div
                    key={categoryName}
                    className="flex items-center gap-3 rounded-lg border border-card-border bg-bg-secondary px-4 py-3 transition-colors hover:border-accent/30"
                  >
                    {/* Rank number */}
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-navy text-white text-sm font-bold shrink-0">
                      {index + 1}
                    </span>

                    {/* Icon + name */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-accent">{CATEGORY_ICONS[categoryName]}</span>
                      <span className="text-sm font-medium text-text-primary truncate">
                        {categoryName}
                      </span>
                      <span className="text-xs text-text-secondary ml-1">
                        ({count} {count === 1 ? 'item' : 'items'})
                      </span>
                    </div>

                    {/* Up/down arrows */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveRanking(index, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded-md text-text-secondary hover:text-navy hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Move ${categoryName} up`}
                      >
                        <ArrowUpIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRanking(index, 'down')}
                        disabled={index === priorityRanking.length - 1}
                        className="p-1 rounded-md text-text-secondary hover:text-navy hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Move ${categoryName} down`}
                      >
                        <ArrowDownIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="mt-8 flex items-center justify-between border-t border-card-border pt-6 pb-4">
        <div className="text-sm text-text-secondary">
          {totalSelected === 0 ? (
            'Select priorities to get started.'
          ) : (
            <>
              <span className="font-medium text-text-primary">{totalSelected}</span>{' '}
              {totalSelected === 1 ? 'item' : 'items'} selected across{' '}
              <span className="font-medium text-text-primary">{priorityRanking.length}</span>{' '}
              {priorityRanking.length === 1 ? 'category' : 'categories'}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="inline-flex items-center gap-2 rounded-lg bg-accent text-white px-5 py-2.5 text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-colors"
        >
          Next: Client Profile
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
