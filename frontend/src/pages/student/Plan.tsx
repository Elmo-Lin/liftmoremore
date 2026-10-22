import { ClipboardList, Lock, Play } from 'lucide-react'
import { useState } from 'react'
import { ButtonLink } from '../../components/ui/Button'
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui/Primitives'
import { PlanDayView } from '../../components/workout/PlanDayView'
import { formatDate, GOAL_LABEL } from '../../lib/format'
import { nextTrainingDay } from '../../lib/stats'
import { useData } from '../../store/contexts'
import { selectPlan, useCurrentStudent } from '../../store/selectors'

export function StudentPlanPage() {
  const { data } = useData()
  const student = useCurrentStudent()!
  const plan = selectPlan(data, student.activePlanId)
  const next = nextTrainingDay(plan, data.workouts, student.id)
  const [dayId, setDayId] = useState<string | null>(null)

  if (!plan) {
    return (
      <div>
        <PageHeader title="我的課表" />
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="教練尚未指派課表"
            description="指派後即可在這裡查看每個訓練日的動作與組數。你仍可以先記錄自主訓練。"
            action={<ButtonLink to="/student/workouts/new">記錄自主訓練</ButtonLink>}
          />
        </Card>
      </div>
    )
  }

  const day = plan.days.find((d) => d.id === dayId) ?? next ?? plan.days[0]

  return (
    <div>
      <PageHeader title={plan.name} description={plan.description} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <Badge tone="accent">{GOAL_LABEL[plan.goal]}</Badge>
        <span>{plan.days.length} 個訓練日</span>
        {plan.weeks && <span>・建議 {plan.weeks} 週</span>}
        <span>・更新於 {formatDate(plan.updatedAt, { year: true })}</span>
      </div>

      <p className="mb-5 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink-600">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
        此課表由 {data.coach.name} 教練撰寫，僅供檢視。若想調整內容，請與教練討論。
      </p>

      <div role="tablist" aria-label="訓練日" className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {plan.days.map((d) => (
          <button
            key={d.id}
            role="tab"
            type="button"
            aria-selected={d.id === day.id}
            onClick={() => setDayId(d.id)}
            className={`h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
              d.id === day.id ? 'border-accent-600 bg-accent-600 text-white' : 'border-transparent bg-fill text-ink-800 hover:bg-[#7676802e]'
            }`}
          >
            {d.name}
            {d.id === next?.id && <span className={`ml-1.5 text-xs ${d.id === day.id ? 'text-white/70' : 'text-accent-700'}`}>下一個</span>}
          </button>
        ))}
      </div>

      <PlanDayView day={day} />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <ButtonLink to={`/student/workouts/new?plan=${plan.id}&day=${day.id}`} icon={Play} variant="accent" className="h-12 sm:h-10">
          開始「{day.name}」
        </ButtonLink>
        <p className="text-xs text-ink-500">以自主訓練記錄，不會扣除教練課堂數。</p>
      </div>
    </div>
  )
}
