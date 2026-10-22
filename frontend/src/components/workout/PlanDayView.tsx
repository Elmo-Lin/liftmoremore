import type { ReactNode } from 'react'
import { useExerciseMap } from '../../store/selectors'
import type { TrainingDay } from '../../types'

export function PlanDayView({ day, action }: { day: TrainingDay; action?: ReactNode }) {
  const exMap = useExerciseMap()
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-medium text-ink-900">{day.name}</p>
          {day.focus && <p className="text-xs text-ink-500">{day.focus}</p>}
        </div>
        {action}
      </div>
      {day.exercises.length ? (
        <ol className="divide-y divide-line">
          {day.exercises.map((rx, i) => (
            <li key={rx.id} className="flex gap-3 px-4 py-2.5">
              <span className="tabular mt-0.5 w-4 shrink-0 text-xs text-ink-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-900">{exMap.get(rx.exerciseId)?.name}</p>
                {rx.notes && <p className="mt-0.5 text-xs text-ink-500">{rx.notes}</p>}
              </div>
              <p className="tabular shrink-0 text-sm text-ink-700">
                {rx.sets} × {rx.reps}
                {rx.targetWeightKg ? <span className="text-ink-500"> @ {rx.targetWeightKg} kg</span> : null}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-3 text-sm text-ink-400">尚未加入動作</p>
      )}
    </div>
  )
}
