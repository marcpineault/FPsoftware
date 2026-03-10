import { useState, useCallback, forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Format a raw numeric string (or number) as $1,234,567 */
function formatAsCurrency(value: string | number): string {
  const num = typeof value === 'number' ? value : parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Strip everything except digits, minus, and decimal point */
function stripNonNumeric(value: string): string {
  return value.replace(/[^0-9.-]/g, '');
}

/* ------------------------------------------------------------------ */
/*  Base Input                                                         */
/* ------------------------------------------------------------------ */

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          className={[
            'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800',
            'placeholder:text-slate-400',
            'transition-all shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-300 focus:border-amber-500 focus:ring-amber-500/20',
            'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
            className,
          ].join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />

        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="mt-1 text-sm text-slate-500">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

/* ------------------------------------------------------------------ */
/*  CurrencyInput                                                      */
/* ------------------------------------------------------------------ */

interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  /** Numeric value (in whole dollars) */
  value?: number | string;
  /** Called with the raw numeric value whenever the user changes it */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called with the parsed numeric value on blur for convenience */
  onValueChange?: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, onValueChange, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    // While focused we show the raw number so the user can edit freely.
    // While blurred we show the formatted currency string.
    const displayValue = (() => {
      if (value === undefined || value === '') return '';
      if (isFocused) {
        // Show raw number while editing
        const raw = typeof value === 'number' ? String(value) : stripNonNumeric(String(value));
        return raw === '0' ? '' : raw;
      }
      return formatAsCurrency(typeof value === 'number' ? value : stripNonNumeric(String(value)));
    })();

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        onFocus?.(e);
      },
      [onFocus],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        const num = parseFloat(stripNonNumeric(e.target.value));
        onValueChange?.(Number.isNaN(num) ? 0 : num);
        onBlur?.(e);
      },
      [onBlur, onValueChange],
    );

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={displayValue}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="$0"
        {...props}
      />
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';
