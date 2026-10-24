import { ArrowDown, ArrowUp, Check, ChevronUp, CopyPlus, History, Keyboard, Minus, Plus, Trash2, X } from 'lucide-react'
import { Fragment, useState } from 'react'
import { formatDate, MUSCLE_LABEL } from '../../lib/format'
import { uid } from '../../lib/id'
import { summarizeSets } from '../../lib/stats'
import type { Exercise, ExerciseLog, ExercisePrescription, SetLog } from '../../types'
import { IconButton } from '../ui/Button'

const fmt = (n: number | null) => (n == null ? '' : String(n))
function parse(text: string, decimals: boolean): number | null {
  const t = text.replace(',', '.').trim()
  if (!t) return null
  const n = decimals ? parseFloat(t) : parseInt(t, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const cellClass = (done: boolean, active: boolean) =>
  `tabular h-11 w-full min-w-0 rounded-[10px] border text-center text-[17px] font-semibold transition-colors ${
    active ? 'border-accent-600 bg-surface ring-3 ring-accent-600/20' : done ? 'border-transparent bg-transparent' : 'border-transparent bg-fill'
  } text-ink-900`

/**
 * Numeric input that tolerates partial input like "62." while typing. On touch screens (`tap`) it
 * is a button instead, opening the ± stepper below the set, so no keyboard pops up unless asked for.
 */
function NumInput({
  value,
  onChange,
  placeholder,
  decimals,
  label,
  max,
  done,
  tap = false,
  active = false,
  typing = false,
  onActivate,
  onTypingEnd,
}: {
  value: number | null
  onChange: (n: number | null) => void
  placeholder?: string
  decimals?: boolean
  label: string
  max: number
  done: boolean
  tap?: boolean
  active?: boolean
  typing?: boolean
  onActivate?: () => void
  onTypingEnd?: () => void
}) {
  const [text, setText] = useState(fmt(value))
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    if (parse(text, !!decimals) !== value) setText(fmt(value))
  }
  if (tap && !typing) {
    return (
      <button type="button" aria-label={label} aria-expanded={active} onClick={onActivate} className={cellClass(done, active)}>
        {value != null ? fmt(value) : <span className="font-normal text-ink-300">{placeholder}</span>}
      </button>
    )
  }
  return (
    <input
      autoFocus={typing}
      onBlur={onTypingEnd}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      enterKeyHint="next"
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const raw = e.target.value
        if (!/^[0-9]*[.,]?[0-9]*$/.test(raw)) return
        const n = parse(raw, !!decimals)
        if (n != null && n > max) return
        setText(raw)
        setPrev(n)
        onChange(n)
      }}
      className={`${cellClass(done, false)} placeholder:font-normal placeholder:text-ink-300 focus:border-accent-600 focus:bg-surface focus:ring-3 focus:ring-accent-600/20 focus:outline-none`}
    />
  )
}

type Field = 'weightKg' | 'reps'
const FIELD_LABEL: Record<Field, string> = { weightKg: '重量 kg', reps: '次數' }
const LIMITS: Record<Field, [number, number]> = { weightKg: [0, 500], reps: [0, 100] }
/** Without history or a plan: an empty bar for 10 reps. */
const DEFAULT_SET = { weightKg: 0, reps: 10 }
/** Touch screens get the ± stepper; mouse users type. */
const touchScreen = () => !(window.matchMedia?.('(pointer: fine)').matches ?? true)

export interface SetSuggestion {
  weightKg: number | null
  reps: number | null
}

export function ExerciseCard({
  log,
  index,
  total,
  exercise,
  prescription,
  last,
  suggestions,
  onChange,
  onMove,
  onRemove,
  onCopyLast,
  onNeedReps,
}: {
  log: ExerciseLog
  index: number
  total: number
  exercise: Exercise | undefined
  prescription?: ExercisePrescription
  last?: { log: ExerciseLog; date: string }
  suggestions: SetSuggestion[]
  onChange: (log: ExerciseLog) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onCopyLast: () => void
  onNeedReps: () => void
}) {
  const doneCount = log.sets.filter((s) => s.completed).length
  const [tap] = useState(touchScreen)
  const [active, setActive] = useState<{ set: number; field: Field } | null>(null)
  const [typing, setTyping] = useState(false)

  const open = (set: number, field: Field) => {
    setTyping(false)
    setActive(active?.set === set && active.field === field ? null : { set, field })
  }
  const stepOf = (field: Field) => (field === 'weightKg' ? exercise?.increment || 2.5 : 1)
  /** The grey suggestion for a set: last time / the plan, else the defaults. */
  const suggestionFor = (i: number) => {
    const sug = suggestions[i] ?? suggestions[suggestions.length - 1]
    return { weightKg: sug?.weightKg ?? DEFAULT_SET.weightKg, reps: sug?.reps ?? DEFAULT_SET.reps }
  }
  /** The value to start from: what is entered, else the grey suggestion. */
  const baseOf = (i: number, field: Field) => log.sets[i][field] ?? suggestionFor(i)[field]
  const step = (i: number, field: Field, dir: 1 | -1) => {
    const [min, max] = LIMITS[field]
    const next = Math.round((baseOf(i, field) + dir * stepOf(field)) * 100) / 100
    updateSet(i, { [field]: Math.min(max, Math.max(min, next)) })
  }
  /** Copies this set's value to the later sets not done yet. */
  const applyToRest = (i: number, field: Field) => {
    const v = log.sets[i][field] ?? baseOf(i, field)
    onChange({ ...log, sets: log.sets.map((s, j) => (j > i && !s.completed ? { ...s, [field]: v } : s)) })
  }

  const updateSet = (i: number, patch: Partial<SetLog>) =>
    onChange({ ...log, sets: log.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  const toggle = (i: number) => {
    if (active?.set === i) setActive(null)
    const s = log.sets[i]
    if (s.completed) return updateSet(i, { completed: false })
    const weightKg = baseOf(i, 'weightKg')
    const reps = baseOf(i, 'reps')
    if (reps <= 0) return onNeedReps()
    updateSet(i, { completed: true, weightKg, reps })
  }

  const addSet = () => {
    const prev = log.sets[log.sets.length - 1]
    const next: SetLog = prev
      ? { id: uid('set'), weightKg: prev.weightKg, reps: prev.reps, rpe: null, completed: false }
      : { id: uid('set'), weightKg: null, reps: null, rpe: null, completed: false }
    onChange({ ...log, sets: [...log.sets, next] })
  }

  return (
    <section className="rounded-xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)]" aria-label={exercise?.name}>
      <header className="flex items-start gap-2 px-4 pt-3.5 pb-2">
        <span className="tabular mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] leading-6 font-semibold text-ink-900">{exercise?.name ?? '未知動作'}</h3>
          <p className="text-xs text-ink-500">
            {exercise && MUSCLE_LABEL[exercise.muscleGroup]}
            {prescription && (
              <>
                <span className="mx-1 text-ink-300">·</span>目標 {prescription.sets} × {prescription.reps}
                {prescription.targetWeightKg ? ` @ ${prescription.targetWeightKg} kg` : ''}
              </>
            )}
            <span className="mx-1 text-ink-300">·</span>
            <span className="tabular">
              {doneCount}/{log.sets.length} 組
            </span>
          </p>
        </div>
        <div className="-mr-1.5 flex items-center">
          <IconButton icon={ArrowUp} label="上移" size="sm" disabled={index === 0} onClick={() => onMove(-1)} />
          <IconButton icon={ArrowDown} label="下移" size="sm" disabled={index === total - 1} onClick={() => onMove(1)} />
          <IconButton icon={Trash2} label="移除動作" size="sm" tone="danger" onClick={onRemove} />
        </div>
      </header>

      {prescription?.notes && <p className="mx-4 mb-2 rounded-lg bg-accent-50 px-3 py-2 text-[13px] text-accent-800">教練提示：{prescription.notes}</p>}

      {last ? (
        <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-ink-500">
          <History className="size-3.5 shrink-0 text-ink-400" />
          <span className="min-w-0 flex-1 truncate">
            上次 {formatDate(last.date)}：<span className="tabular text-ink-700">{summarizeSets(last.log)}</span>
          </span>
          <button
            type="button"
            onClick={onCopyLast}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-medium text-accent-700 hover:bg-accent-50"
          >
            <CopyPlus className="size-3.5" />
            帶入
          </button>
        </div>
      ) : (
        <p className="mx-4 mb-2 text-xs text-ink-400">尚無此動作的歷史紀錄</p>
      )}

      <div className="px-2 pb-2 sm:px-3">
        <div className="grid grid-cols-[1.75rem_1fr_1fr_2.75rem_1.75rem] items-center gap-1.5 px-1 pb-1 text-[11px] font-medium text-ink-400 sm:gap-2">
          <span className="text-center">組</span>
          <span className="text-center">重量 kg</span>
          <span className="text-center">次數</span>
          <span className="text-center">完成</span>
          <span />
        </div>
        {log.sets.map((s, i) => {
          const sug = suggestionFor(i)
          const cell = (field: Field) => ({
            tap,
            active: active?.set === i && active.field === field,
            typing: typing && active?.set === i && active.field === field,
            onActivate: () => open(i, field),
            onTypingEnd: () => setTyping(false),
          })
          const rest = log.sets.filter((x, j) => j > i && !x.completed).length
          return (
            <Fragment key={s.id}>
              <div
                className={`grid grid-cols-[1.75rem_1fr_1fr_2.75rem_1.75rem] items-center gap-1.5 rounded-lg px-1 py-1 transition-colors sm:gap-2 ${
                  s.completed ? 'bg-accent-50' : ''
                }`}
              >
                <span className="tabular text-center text-sm font-medium text-ink-500">{i + 1}</span>
                <NumInput
                  label={`第 ${i + 1} 組重量`}
                  value={s.weightKg}
                  decimals
                  max={500}
                  done={s.completed}
                  placeholder={String(sug.weightKg)}
                  onChange={(n) => updateSet(i, { weightKg: n })}
                  {...cell('weightKg')}
                />
                <NumInput
                  label={`第 ${i + 1} 組次數`}
                  value={s.reps}
                  max={100}
                  done={s.completed}
                  placeholder={String(sug.reps)}
                  onChange={(n) => updateSet(i, { reps: n })}
                  {...cell('reps')}
                />
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={s.completed}
                  aria-label={s.completed ? `取消完成第 ${i + 1} 組` : `完成第 ${i + 1} 組`}
                  className={`mx-auto inline-flex size-10 items-center justify-center rounded-full border-2 transition-colors ${
                    s.completed ? 'border-accent-600 bg-accent-600 text-white' : 'border-ink-300 bg-surface text-transparent hover:border-accent-600 hover:text-accent-600/40'
                  }`}
                >
                  <Check className="size-5" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActive(null)
                    onChange({ ...log, sets: log.sets.filter((_, j) => j !== i) })
                  }}
                  aria-label={`刪除第 ${i + 1} 組`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-ink-300 hover:bg-danger-50 hover:text-danger-600"
                >
                  <X className="size-4" />
                </button>
              </div>
              {active?.set === i && !typing && (
                <SetStepper
                  label={FIELD_LABEL[active.field]}
                  value={s[active.field]}
                  base={baseOf(i, active.field)}
                  step={stepOf(active.field)}
                  rest={rest}
                  onStep={(dir) => step(i, active.field, dir)}
                  onApplyToRest={() => applyToRest(i, active.field)}
                  onType={() => setTyping(true)}
                  onClose={() => setActive(null)}
                />
              )}
            </Fragment>
          )
        })}
        <button
          type="button"
          onClick={addSet}
          className="mt-1 flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-fill text-[15px] font-medium text-accent-700 hover:bg-[#7676802e]"
        >
          <Plus className="size-4" />
          新增一組{log.sets.length ? '（複製上一組）' : ''}
        </button>
      </div>
    </section>
  )
}

/** ± buttons under a set (touch screens), so most changes need no keyboard. */
function SetStepper({
  label,
  value,
  base,
  step,
  rest,
  onStep,
  onApplyToRest,
  onType,
  onClose,
}: {
  label: string
  value: number | null
  base: number
  step: number
  rest: number
  onStep: (dir: 1 | -1) => void
  onApplyToRest: () => void
  onType: () => void
  onClose: () => void
}) {
  const stepButton = 'tabular inline-flex h-12 min-w-[4.5rem] items-center justify-center gap-1 rounded-xl bg-surface px-3 text-[15px] font-semibold text-accent-700 shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:bg-accent-50'
  return (
    <div className="mx-1 mt-0.5 mb-2 rounded-xl bg-canvas p-2">
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${label}減 ${step}`} onClick={() => onStep(-1)} className={stepButton}>
          <Minus className="size-4" strokeWidth={2.5} />
          {step}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[11px] text-ink-500">{label}</p>
          <p className="tabular text-[22px] leading-7 font-semibold text-ink-900">
            {value ?? base}
            {value == null && <span className="ml-1 text-[11px] font-normal text-ink-400">建議</span>}
          </p>
        </div>
        <button type="button" aria-label={`${label}加 ${step}`} onClick={() => onStep(1)} className={stepButton}>
          <Plus className="size-4" strokeWidth={2.5} />
          {step}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1">
        {rest > 0 && (
          <button type="button" onClick={onApplyToRest} className="h-8 rounded-lg px-2.5 text-[13px] font-medium text-accent-700 active:bg-accent-50">
            套用到後面 {rest} 組
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onType} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-ink-600 active:bg-subtle">
          <Keyboard className="size-4" />
          輸入
        </button>
        <button type="button" aria-label="收起" onClick={onClose} className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 active:bg-subtle">
          <ChevronUp className="size-4" />
        </button>
      </div>
    </div>
  )
}
