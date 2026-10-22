import { CalendarDays, ChevronRight, ClipboardList, Dumbbell, Flame, Play, Ticket, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '../../components/ui/Button'
import { BalanceMeter, Card, CardHeader, DemoNotice, EmptyState, PageHeader } from '../../components/ui/Primitives'
import { WorkoutDetailModal, WorkoutRow } from '../../components/workout/WorkoutDetail'
import { addDays, formatDate, formatTime, relativeDay } from '../../lib/format'
import { LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { nextTrainingDay, recentPRs, weekStreak, workoutDate } from '../../lib/stats'
import { useData } from '../../store/contexts'
import { selectBalance, selectCompleted, selectDrafts, selectNextAppointment, selectPlan, useCurrentStudent, useExerciseMap } from '../../store/selectors'
import type { WorkoutSession } from '../../types'

export function StudentDashboardPage() {
  const { data } = useData()
  const student = useCurrentStudent()!
  const exMap = useExerciseMap()
  const [open, setOpen] = useState<WorkoutSession | null>(null)

  const workouts = useMemo(() => selectCompleted(data, student.id), [data, student.id])
  const balance = selectBalance(data, student.id)
  const next = selectNextAppointment(data, student.id)
  const plan = selectPlan(data, student.activePlanId)
  const day = nextTrainingDay(plan, data.workouts, student.id)
  const prs = useMemo(() => recentPRs(workouts, addDays(new Date(), -28).toISOString()).slice(0, 3), [workouts])
  const streak = useMemo(() => weekStreak(workouts), [workouts])
  const now = new Date()
  const thisMonth = workouts.filter((w) => {
    const d = new Date(workoutDate(w))
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const draft = selectDrafts(data, student.id, 'student')[0]
  const current = balance.packages.find((b) => b.remaining > 0) ?? balance.packages.at(-1)

  return (
    <div>
      <PageHeader
        title={`嗨，${student.name.slice(-2)}`}
        description={workouts[0] ? `上次訓練是${relativeDay(workoutDate(workouts[0]))}，這個月已完成 ${thisMonth} 次訓練。` : '歡迎！完成第一次訓練後，這裡會顯示你的進度。'}
        actions={
          <ButtonLink to="/student/workouts/new" icon={Dumbbell} variant="accent">
            記錄自主訓練
          </ButtonLink>
        }
      />

      {draft && (
        <Link
          to={`/student/workouts/new?draft=${draft.id}`}
          className="mb-4 flex items-center gap-3 rounded-lg border border-line border-l-2 border-l-warn-600 bg-surface px-4 py-2.5 text-sm text-ink-700 hover:bg-raised"
        >
          <Dumbbell className="size-4 shrink-0 text-warn-600" />
          <span className="flex-1">你有一筆未完成的自主訓練：{draft.title}</span>
          <span className="font-medium text-ink-900">繼續</span>
        </Link>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between text-[13px] text-ink-500">
            下次教練課
            <CalendarDays className="size-4 text-ink-300" />
          </div>
          {next ? (
            <>
              <p className="mt-2 text-xl font-semibold text-ink-900">
                {relativeDay(next.startAt)} {formatTime(next.startAt)}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {formatDate(next.startAt, { weekday: true })}・{next.location}・{next.durationMin} 分鐘
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-500">目前沒有排定的課程</p>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-[13px] text-ink-500">
            剩餘教練課
            <Ticket className="size-4 text-ink-300" />
          </div>
          <p className={`num mt-2 text-[28px] ${balance.remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : 'text-ink-900'}`}>
            {balance.remaining}
            <span className="ml-1 text-sm font-normal text-ink-500">堂</span>
          </p>
          {current && (
            <div className="mt-3">
              <BalanceMeter remaining={current.remaining} total={current.total + Math.max(0, current.adjusted)} />
            </div>
          )}
          <p className="mt-2 text-xs text-ink-500">自主訓練不會扣除堂數{balance.remaining <= LOW_BALANCE_THRESHOLD ? '・堂數不多了，可與教練討論續約' : ''}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-[13px] text-ink-500">
            連續訓練
            <Flame className="size-4 text-ink-300" />
          </div>
          <p className="num mt-2 text-[28px] text-ink-900">
            {streak}
            <span className="ml-1 text-sm font-normal text-ink-500">週</span>
          </p>
          <p className="mt-2 text-xs text-ink-500">每週至少完成一次訓練即算一週・目標每週 {student.weeklyFrequency} 次</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="我的課表"
            description={plan ? plan.name : undefined}
            action={
              plan && (
                <Link to="/student/plan" className="text-xs font-medium text-accent-700 hover:underline">
                  查看完整課表
                </Link>
              )
            }
          />
          {plan && day ? (
            <div className="px-5 pb-5">
              <div className="rounded-xl bg-canvas p-4">
                <p className="text-xs text-ink-500">下一個訓練日</p>
                <p className="mt-0.5 text-[17px] font-semibold text-ink-900">{day.name}</p>
                <p className="mt-1 text-[13px] text-ink-600">{day.exercises.map((r) => exMap.get(r.exerciseId)?.name).join('、')}</p>
                <ButtonLink to={`/student/workouts/new?plan=${plan.id}&day=${day.id}`} icon={Play} variant="accent" className="mt-4 h-11 w-full sm:w-auto">
                  開始此訓練
                </ButtonLink>
              </div>
            </div>
          ) : (
            <EmptyState compact icon={ClipboardList} title="教練尚未指派課表" description="你仍可以從空白開始記錄自主訓練。" />
          )}
        </Card>

        <Card>
          <CardHeader title="近期進步" description="近 4 週實際完成的新最重紀錄" />
          {prs.length ? (
            <ul className="space-y-2 px-5 pb-5">
              {prs.map((p) => (
                <li key={p.exerciseId} className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2.5">
                  <Trophy className="size-4 shrink-0 text-accent-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">{exMap.get(p.exerciseId)?.name}</p>
                    <p className="text-xs text-ink-500">
                      {formatDate(p.date)}・先前最重 {p.previous} kg
                    </p>
                  </div>
                  <p className="tabular text-sm font-semibold text-ink-900">
                    {p.weight} kg × {p.reps}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Trophy} title="近 4 週沒有新紀錄" description="持續穩定訓練，進步會慢慢累積。" />
          )}
          <Link to="/student/progress" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-ink-700 hover:bg-subtle/60">
            查看進步追蹤
            <ChevronRight className="size-4 text-ink-400" />
          </Link>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="最近訓練"
          action={
            <Link to="/student/history" className="text-xs font-medium text-accent-700 hover:underline">
              全部紀錄
            </Link>
          }
        />
        {workouts.length ? (
          <div className="divide-y divide-line border-t border-line">
            {workouts.slice(0, 4).map((w) => (
              <WorkoutRow key={w.id} workout={w} onOpen={() => setOpen(w)} />
            ))}
          </div>
        ) : (
          <EmptyState compact icon={Dumbbell} title="還沒有訓練紀錄" />
        )}
      </Card>
      <DemoNotice className="mt-6" />
      <WorkoutDetailModal workout={open} onClose={() => setOpen(null)} audience="student" />
    </div>
  )
}
