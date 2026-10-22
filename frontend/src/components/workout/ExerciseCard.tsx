import { ArrowDown, ArrowUp, Check, CopyPlus, History, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
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

/** Numeric input that tolerates partial input like "62." while typing. */
function NumInput({
  value,
  onChange,
  placeholder,
  decimals,
  label,
  max,
  done,
}: {
  value: number | null
  onChange: (n: number | null) => void
  placeholder?: string
  decimals?: boolean
  label: string
  max: number
  done: boolean
}) {
  const [text, setText] = useState(fmt(value))
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    if (parse(text, !!decimals) !== value) setText(fmt(value))
  }
  return (
    <input
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
      className={`tabular h-11 w-full min-w-0 rounded-[10px] border text-center text-[17px] font-semibold transition-colors placeholder:font-normal placeholder:text-ink-300 focus:border-accent-600 focus:bg-surface focus:ring-3 focus:ring-accent-600/20 focus:outline-none ${
        done ? 'border-transparent bg-transparent text-ink-900' : 'border-transparent bg-fill text-ink-900'
      }`}
    />
  )
}

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

  const updateSet = (i: number, patch: Partial<SetLog>) =>
    onChange({ ...log, sets: log.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  const toggle = (i: number) => {
    const s = log.sets[i]
    if (s.completed) return updateSet(i, { completed: false })
    const sug = suggestions[i] ?? suggestions[suggestions.length - 1]
    const weightKg = s.weightKg ?? sug?.weightKg ?? null
    const reps = s.reps ?? sug?.reps ?? null
    if (reps == null || reps <= 0) return onNeedReps()
    updateSet(i, { completed: true, weightKg: weightKg ?? 0, reps })
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
        <div className="grid grid-cols-[1.75rem_1fr_1fr_0.8fr_2.75rem_1.75rem] items-center gap-1.5 px-1 pb-1 text-[11px] font-medium text-ink-400 sm:gap-2">
          <span className="text-center">組</span>
          <span className="text-center">重量 kg</span>
          <span className="text-center">次數</span>
          <span className="text-center">RPE</span>
          <span className="text-center">完成</span>
          <span />
        </div>
        {log.sets.map((s, i) => {
          const sug = suggestions[i] ?? suggestions[suggestions.length - 1]
          return (
            <div
              key={s.id}
              className={`grid grid-cols-[1.75rem_1fr_1fr_0.8fr_2.75rem_1.75rem] items-center gap-1.5 rounded-lg px-1 py-1 transition-colors sm:gap-2 ${
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
                placeholder={sug?.weightKg != null ? String(sug.weightKg) : '—'}
                onChange={(n) => updateSet(i, { weightKg: n })}
              />
              <NumInput
                label={`第 ${i + 1} 組次數`}
                value={s.reps}
                max={100}
                done={s.completed}
                placeholder={sug?.reps != null ? String(sug.reps) : '—'}
                onChange={(n) => updateSet(i, { reps: n })}
              />
              <NumInput
                label={`第 ${i + 1} 組 RPE`}
                value={s.rpe}
                decimals
                max={10}
                done={s.completed}
                placeholder="—"
                onChange={(n) => updateSet(i, { rpe: n })}
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
                onClick={() => onChange({ ...log, sets: log.sets.filter((_, j) => j !== i) })}
                aria-label={`刪除第 ${i + 1} 組`}
                className="inline-flex size-7 items-center justify-center rounded-md text-ink-300 hover:bg-danger-50 hover:text-danger-600"
              >
                <X className="size-4" />
              </button>
            </div>
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
