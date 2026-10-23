import { CalendarDays, ClipboardList, Lock, MapPin, Play } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ButtonLink } from '../../components/ui/Button'
import { Badge, Card, DemoNotice, EmptyState, PageHeader, Tabs } from '../../components/ui/Primitives'
import { PlanDayView } from '../../components/workout/PlanDayView'
import { formatDate, formatTime, GOAL_LABEL, relativeDay } from '../../lib/format'
import { endOf, STATUS_LABEL } from '../../lib/schedule'
import { nextTrainingDay } from '../../lib/stats'
import { useData } from '../../store/contexts'
import { selectPlan, useCurrentStudent } from '../../store/selectors'
import type { Student } from '../../types'

type Tab = 'schedule' | 'plan'

/** 課表: upcoming classes with the coach, and the training plan they assigned. */
export function StudentPlanPage() {
  const student = useCurrentStudent()!
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'plan' ? 'plan' : 'schedule'
  return (
    <div>
      <PageHeader title="我的課表" />
      <Tabs
        value={tab}
        onChange={(t) => setParams(t === 'plan' ? { tab: 'plan' } : {}, { replace: true })}
        tabs={[
          { value: 'schedule', label: '上課時間' },
          { value: 'plan', label: '訓練計畫' },
        ]}
      />
      <div className="mt-4">{tab === 'schedule' ? <UpcomingClasses student={student} /> : <AssignedPlan student={student} />}</div>
      <DemoNotice className="mt-6" />
    </div>
  )
}

function UpcomingClasses({ student }: { student: Student }) {
  const { data } = useData()
  const now = new Date()
  const upcoming = data.appointments
    .filter((a) => a.studentId === student.id && endOf(a) > now.getTime())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  if (!upcoming.length) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="目前沒有排定的課程" description="教練安排上課時間後，會顯示在這裡。" />
      </Card>
    )
  }
  return (
    <Card className="divide-y divide-line">
      {upcoming.map((a) => {
        const cancelled = a.status === 'cancelled'
        return (
          <div key={a.id} className={`flex items-center gap-4 px-5 py-3.5 ${cancelled ? 'opacity-60' : ''}`}>
            <div className="w-14 shrink-0 text-center">
              <p className="text-xs text-ink-500">{relativeDay(a.startAt)}</p>
              <p className={`tabular text-[17px] font-semibold text-ink-900 ${cancelled ? 'line-through' : ''}`}>{formatTime(a.startAt)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium text-ink-900 ${cancelled ? 'line-through' : ''}`}>
                {formatDate(a.startAt, { weekday: true })} {formatTime(a.startAt)}–{formatTime(new Date(endOf(a)))}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-500">
                <MapPin className="size-3 shrink-0" />
                {a.location}・{a.durationMin} 分鐘
              </p>
            </div>
            {cancelled && <Badge>{STATUS_LABEL[a.status]}</Badge>}
          </div>
        )
      })}
    </Card>
  )
}

function AssignedPlan({ student }: { student: Student }) {
  const { data } = useData()
  const plan = selectPlan(data, student.activePlanId)
  const next = nextTrainingDay(plan, data.workouts, student.id)
  const [dayId, setDayId] = useState<string | null>(null)

  if (!plan) {
    return (
      <div>
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="教練尚未指派訓練計畫"
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
      <h2 className="text-[17px] font-semibold text-ink-900">{plan.name}</h2>
      {plan.description && <p className="mt-1 mb-3 text-sm text-ink-600">{plan.description}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <Badge tone="accent">{GOAL_LABEL[plan.goal]}</Badge>
        <span>{plan.days.length} 個訓練日</span>
        {plan.weeks && <span>・建議 {plan.weeks} 週</span>}
        <span>・更新於 {formatDate(plan.updatedAt, { year: true })}</span>
      </div>

      <p className="mb-5 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink-600">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
        此計畫由 {data.coach.name} 教練撰寫，僅供檢視。若想調整內容，請與教練討論。
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
