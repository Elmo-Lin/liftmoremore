import { ArrowRight, Check } from 'lucide-react'
import { DEMO_PERSONAS, type DemoPersona } from '../../data/mock'

/** The six demo identities, grouped by workspace: studio (owner, coach, student), free coach (coach, student), self-tracker. */
export function DemoPersonaList({ current, onPick }: { current?: DemoPersona; onPick: (p: DemoPersona) => void }) {
  return (
    <div className="space-y-4">
      {DEMO_PERSONAS.map((g) => (
        <div key={g.space}>
          <p className="mb-1.5 text-xs font-medium text-ink-500">{g.group}</p>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line-strong">
            {g.personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                aria-current={current === p.id || undefined}
                className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent-50 ${current === p.id ? 'bg-accent-50' : 'bg-surface'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-ink-900">{p.title}</span>
                  <span className="block truncate text-[13px] text-ink-500">{p.who}</span>
                </span>
                {current === p.id ? (
                  <Check className="size-4 shrink-0 text-accent-700" />
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700" />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
