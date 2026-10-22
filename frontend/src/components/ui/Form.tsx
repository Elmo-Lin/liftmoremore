import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

export const inputClass =
  'w-full rounded-lg border border-transparent bg-fill px-3 text-[17px] text-ink-900 placeholder:text-ink-400 transition-colors focus:border-accent-600 focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent-600/20 disabled:text-ink-500 md:text-[15px]'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: (id: string) => ReactNode
  className?: string
}

export function Field({ label, error, hint, required, children, className = '' }: FieldProps) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-500">
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1 text-xs text-danger-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; containerClassName?: string }

export function TextInput({ label, error, hint, required, containerClassName, className = '', ...rest }: TextInputProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
      {(id) => (
        <input
          id={id}
          aria-invalid={!!error}
          className={`${inputClass} h-10 ${error ? 'border-danger-600' : ''} ${className}`}
          {...rest}
        />
      )}
    </Field>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string; containerClassName?: string }

export function SelectInput({ label, error, hint, required, containerClassName, className = '', children, ...rest }: SelectProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
      {(id) => (
        <select id={id} className={`${inputClass} h-10 pr-8 ${className}`} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string; containerClassName?: string }

export function TextArea({ label, error, hint, required, containerClassName, className = '', ...rest }: TextAreaProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
      {(id) => <textarea id={id} className={`${inputClass} min-h-20 py-2 ${className}`} {...rest} />}
    </Field>
  )
}

/** Bare select for toolbars (label is visually hidden). */
export function ToolbarSelect({ label, className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <select aria-label={label} className={`${inputClass} h-9 w-auto pr-8 text-sm ${className}`} {...rest}>
      {children}
    </select>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-[9px] bg-fill p-[2px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[7px] px-3.5 font-medium transition-all ${size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]'} ${
            value === o.value ? 'bg-surface text-ink-900 shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]' : 'text-ink-700 hover:text-ink-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
