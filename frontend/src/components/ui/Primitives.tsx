import type { LucideIcon } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { initials } from '../../lib/format'

/** Inset-grouped card: white, rounded, no border on the gray grouped background. */
export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, className = '' }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-3 px-5 pt-4 pb-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-[17px] font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** iOS "large title" header. */
export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: ReactNode
  eyebrow?: ReactNode
}) {
  return (
    <div className="mb-6">
      {back && <div className="mb-2">{back}</div>}
      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-tight font-bold tracking-[-0.02em] text-ink-900 md:text-[34px]">{title}</h1>
          {description && <p className="mt-1 text-[15px] text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

type Tone = 'neutral' | 'accent' | 'warn' | 'danger' | 'alt'
const tones: Record<Tone, string> = {
  neutral: 'bg-fill text-ink-600',
  accent: 'bg-accent-50 text-accent-700',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
  alt: 'bg-alt-50 text-alt-600',
}

export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {Icon && <Icon className="size-3" strokeWidth={2.25} />}
      {children}
    </span>
  )
}

/** Contacts-style monogram. */
export function Avatar({ name, size = 'md' }: { name: string; id?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'size-8 text-[11px]' : size === 'lg' ? 'size-14 text-lg' : 'size-10 text-[13px]'
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#a9aeb8] to-[#868a94] font-semibold text-white ${dim}`}
    >
      {initials(name)}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, action, compact }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}>
      <Icon className="mb-3 size-9 text-ink-300" strokeWidth={1.5} />
      <p className="text-[17px] font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[15px] text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** `to`: the card links to the page with the details behind the number. */
export function Stat({ label, value, unit, sub, icon: Icon, tone = 'default', to }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; icon?: LucideIcon; tone?: 'default' | 'warn'; to?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        {Icon && <Icon className={`size-4 ${tone === 'warn' ? 'text-warn-500' : 'text-accent-600'}`} strokeWidth={2} />}
      </div>
      <p className={`num mt-2 text-[30px] md:text-[32px] ${tone === 'warn' ? 'text-warn-600' : 'text-ink-900'}`}>
        {value}
        {unit && <span className="ml-1 font-sans text-[15px] font-medium tracking-normal text-ink-500">{unit}</span>}
      </p>
      {sub && <div className="mt-1.5 text-xs text-ink-500">{sub}</div>}
    </>
  )
  if (!to) return <Card className="px-4 py-3.5 md:px-5 md:py-4">{body}</Card>
  return (
    <Link to={to} className="block rounded-xl bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-colors hover:bg-raised active:bg-subtle md:px-5 md:py-4">
      {body}
    </Link>
  )
}

/** iOS segmented control. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div role="tablist" className="inline-flex min-w-full gap-0.5 rounded-[9px] bg-fill p-[2px] sm:min-w-0">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={`h-8 flex-1 shrink-0 rounded-[7px] px-3.5 text-[13px] font-medium whitespace-nowrap transition-all sm:flex-none ${
              value === t.value ? 'bg-surface text-ink-900 shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]' : 'text-ink-700 hover:text-ink-900'
            }`}
          >
            {t.label}
            {t.count != null && <span className="ml-1 text-ink-400">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DemoNotice({ className = '' }: { className?: string }) {
  return <p className={`text-xs text-ink-400 ${className}`}>示範資料：所有人物與數據皆為虛構。</p>
}

/** iOS-style progress bar; orange when the balance is low. */
export function BalanceMeter({ remaining, total }: { remaining: number; total: number }) {
  const cap = Math.max(total, remaining)
  const pct = cap > 0 ? Math.min(100, (remaining / cap) * 100) : 0
  const low = remaining <= 3
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle" aria-hidden>
      <div className={`h-full rounded-full ${low ? 'bg-warn-500' : 'bg-accent-600'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
