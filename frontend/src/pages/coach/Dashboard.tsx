import { Building2, CalendarDays, ChevronRight, CircleCheck, ClipboardPlus, Dumbbell, Play, Ticket, TriangleAlert, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '../../components/ui/Button'
import { Avatar, Badge, Card, CardHeader, DemoNotice, EmptyState, PageHeader, Stat } from '../../components/ui/Primitives'
import { WorkoutDetailModal, WorkoutRow } from '../../components/workout/WorkoutDetail'
import { formatDate, formatTime, givenName, isSameDay, relativeDay } from '../../lib/format'
import { LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { nextTrainingDay, workoutDate } from '../../lib/stats'
import { seatsOf, seatsUsed } from '../../store/actions'
import { useData, useSession } from '../../store/contexts'
import { selectBalance, selectCoachName, selectCoachOf, selectCompleted, selectDrafts, selectPlan, selectStudent } from '../../store/selectors'
import type { WorkoutSession } from '../../types'

function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 11) return '早安'
  if (h < 18) return '午安'
  return '晚安'
}

export function CoachDashboardPage() {
  const { data } = useData()
  const { session } = useSession()
  // Studio owners see every coach's classes: say whose each one is.
  const multiCoach = session?.role === 'owner' && (data.studio?.coaches.length ?? 0) > 1
  const [open, setOpen] = useState<WorkoutSession | null>(null)
  const now = new Date()

  const active = data.students.filter((s) => s.status === 'active')
  const todays = data.appointments
    .filter((a) => a.status === 'scheduled' && isSameDay(a.startAt, now))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  const completed = selectCompleted(data)
  const monthCoached = completed.filter((w) => {
    const d = new Date(workoutDate(w))
    return w.type === 'coached' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const todayDone = completed.filter((w) => w.type === 'coached' && isSameDay(workoutDate(w), now))
  const lowBalance = active
    .map((s) => ({ student: s, balance: selectBalance(data, s.id) }))
    .filter((x) => x.balance.remaining <= LOW_BALANCE_THRESHOLD)
    .sort((a, b) => a.balance.remaining - b.balance.remaining)
  const drafts = selectDrafts(data, undefined, 'coach')
  const recent = completed.slice(0, 8)

  return (
    <div>
      <PageHeader
        title={`${greeting(now)}，${givenName(data.coach.name)}`}
        description={`${formatDate(now, { year: true, weekday: true })}・今天有 ${todays.length} 堂課`}
        actions={
          <>
            <ButtonLink to="/coach/students?new=1" variant="secondary" icon={UserPlus}>
              新增學員
            </ButtonLink>
            <ButtonLink to="/coach/plans/new" variant="secondary" icon={ClipboardPlus}>
              建立計畫
            </ButtonLink>
            <ButtonLink to="/coach/workouts/new" icon={Dumbbell} variant="accent">
              開始訓練
            </ButtonLink>
          </>
        }
      />

      {/* Phones: the tab bar has no room for 工作室, so owners get the way in here (desktop has it in the sidebar). */}
      {session?.role === 'owner' && data.studio && (
        <Link
          to="/coach/studio"
          className="mb-4 flex items-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] active:bg-subtle md:hidden"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
            <Building2 className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink-900">{data.studio.name || '工作室'}</span>
            <span className="block text-xs text-ink-500">
              教練名額 {seatsUsed(data)} / {seatsOf(data)}・管理教練與學員
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-ink-400" />
        </Link>
      )}

      {drafts.length > 0 && (
        <Link
          to={`/coach/workouts/new?draft=${drafts[0].id}`}
          className="mb-4 flex items-center gap-3 rounded-lg border border-line border-l-2 border-l-warn-600 bg-surface px-4 py-2.5 text-sm text-ink-700 hover:bg-raised"
        >
          <TriangleAlert className="size-4 shrink-0 text-warn-600" />
          <span className="flex-1">
            有 {drafts.length} 筆未完成的訓練：{selectStudent(data, drafts[0].studentId)?.name}・{drafts[0].title}（{relativeDay(drafts[0].startedAt)} {formatTime(drafts[0].startedAt)}）
          </span>
          <span className="font-medium text-ink-900">繼續記錄</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="進行中學員" value={active.length} unit="位" icon={Users} sub={`共 ${data.students.length} 位，${data.students.length - active.length} 位暫停`} />
        <Stat label="今日課程" value={todays.length} unit="堂" icon={CalendarDays} sub={`已完成記錄 ${todayDone.length} 堂`} />
        <Stat label="本月完成課程" value={monthCoached.length} unit="堂" icon={CircleCheck} sub="教練課，不含自主訓練" />
        <Stat
          label="堂數偏低"
          value={lowBalance.length}
          unit="位"
          icon={Ticket}
          tone={lowBalance.length ? 'warn' : 'default'}
          sub={`剩餘 ${LOW_BALANCE_THRESHOLD} 堂以下`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="今日課程"
            action={
              <Link to="/coach/schedule" className="text-xs font-medium text-accent-700 hover:underline">
                完整課表
              </Link>
            }
          />
          {todays.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {todays.map((a) => {
                const s = selectStudent(data, a.studentId)
                if (!s) return null
                const plan = selectPlan(data, s.activePlanId)
                const day = nextTrainingDay(plan, data.workouts, s.id)
                const done = todayDone.some((w) => w.studentId === s.id)
                const bal = selectBalance(data, s.id)
                const href = plan && day ? `/coach/workouts/new?student=${s.id}&plan=${plan.id}&day=${day.id}` : `/coach/workouts/new?student=${s.id}`
                return (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="tabular w-12 shrink-0 text-sm font-semibold text-ink-800">{formatTime(a.startAt)}</span>
                    <Avatar name={s.name} id={s.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/coach/students/${s.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                        {s.name}
                      </Link>
                      <p className="truncate text-xs text-ink-500">
                        {multiCoach && `${selectCoachName(data, selectCoachOf(data, s.id))}・`}
                        {day ? `下一堂：${day.name}` : '未指派計畫'}・剩 {bal.remaining} 堂
                      </p>
                    </div>
                    {done ? (
                      <Badge tone="accent" icon={CircleCheck}>
                        已記錄
                      </Badge>
                    ) : (
                      <ButtonLink to={href} size="sm" icon={Play} variant="secondary">
                        開始
                      </ButtonLink>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState compact icon={CalendarDays} title="今天沒有排定的課程" />
          )}
        </Card>

        <Card>
          <CardHeader title="堂數偏低的學員" description="建議提醒續約" />
          {lowBalance.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {lowBalance.map(({ student: s, balance }) => (
                <li key={s.id}>
                  <Link to={`/coach/students/${s.id}?tab=packages`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                    <Avatar name={s.name} id={s.id} size="sm" />
                    <span className="flex-1 text-sm font-medium text-ink-900">{s.name}</span>
                    <span className={`text-sm font-semibold ${balance.remaining === 0 ? 'text-danger-600' : 'text-warn-600'}`}>
                      剩 {balance.remaining} 堂
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Ticket} title="所有學員堂數充足" />
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="最近訓練" description="包含教練課與學員自主訓練" />
        {recent.length ? (
          <div className="divide-y divide-line border-t border-line">
            {recent.map((w) => (
              <WorkoutRow key={w.id} workout={w} showStudent showDeduction onOpen={() => setOpen(w)} />
            ))}
          </div>
        ) : (
          <EmptyState compact icon={Dumbbell} title="尚無訓練紀錄" />
        )}
      </Card>

      <DemoNotice className="mt-6" />
      <WorkoutDetailModal workout={open} onClose={() => setOpen(null)} audience="coach" />
    </div>
  )
}
