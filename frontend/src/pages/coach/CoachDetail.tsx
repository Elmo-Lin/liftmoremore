import { ArrowLeft, CalendarDays, Check, ChevronRight, Ticket, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ButtonLink } from '../../components/ui/Button'
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from '../../components/ui/Primitives'
import { WorkoutDetailModal, WorkoutRow } from '../../components/workout/WorkoutDetail'
import { addDays, formatDate, formatTime, relativeDay, startOfWeek } from '../../lib/format'
import { endOf } from '../../lib/schedule'
import { LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { workoutDate } from '../../lib/stats'
import { coachStats, studentIdsOf } from '../../lib/studio'
import { useData, useSession } from '../../store/contexts'
import { selectBalance, selectCompleted, selectStudent } from '../../store/selectors'
import type { WorkoutSession } from '../../types'

/** Studio owners: one coach at a glance — their students, this week's classes and recent sessions they taught. */
export function CoachDetailPage() {
  const { id } = useParams()
  const { data } = useData()
  const { session } = useSession()
  const [open, setOpen] = useState<WorkoutSession | null>(null)
  const coach = data.studio?.coaches.find((c) => c.id === id)
  if (session?.role !== 'owner' || !coach) return <Navigate to="/coach/studio" replace />

  const stats = coachStats(data, coach.id)
  const ids = studentIdsOf(data, coach.id)
  const students = data.students
    .filter((s) => ids.has(s.id))
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'active' ? -1 : 1))
  const weekStart = startOfWeek(new Date())
  const weekEnd = addDays(weekStart, 7)
  const week = data.appointments
    .filter((a) => ids.has(a.studentId) && new Date(a.startAt) >= weekStart && new Date(a.startAt) < weekEnd)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  const taught = data.workouts
    .filter((w) => w.type === 'coached' && w.status === 'completed' && w.coachId === coach.id)
    .sort((a, b) => workoutDate(b).localeCompare(workoutDate(a)))
    .slice(0, 8)
  const me = coach.id === data.coach.id

  return (
    <div>
      <Link to="/coach/studio" className="mb-3 inline-flex items-center gap-1 text-sm text-accent-700 hover:underline">
        <ArrowLeft className="size-4" />
        工作室
      </Link>
      <PageHeader
        title={coach.name}
        description={[coach.role === 'owner' ? '經營者' : coach.title, coach.email].filter(Boolean).join('・')}
        actions={
          <ButtonLink to={`/coach/schedule?coach=${coach.id}`} variant="secondary" icon={CalendarDays}>
            {me ? '我的課表' : '查看課表'}
          </ButtonLink>
        }
      />
      {coach.status !== 'active' && (
        <p className="-mt-2 mb-4">
          <Badge tone={coach.status === 'invited' ? 'warn' : 'neutral'}>{coach.status === 'invited' ? '待啟用' : '已停用'}</Badge>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="進行中學員" value={stats.students} unit="位" icon={Users} to={`/coach/students?coach=${coach.id}`} />
        <Stat label="本週課程" value={stats.thisWeek} unit="堂" icon={CalendarDays} to={`/coach/schedule?coach=${coach.id}`} />
        <Stat label="本月完成課程" value={stats.sessions} unit="堂" icon={Check} sub="教練課，不含自主訓練" />
        <Stat
          label="堂數偏低"
          value={stats.low}
          unit="位"
          icon={Ticket}
          tone={stats.low ? 'warn' : 'default'}
          sub={`剩餘 ${LOW_BALANCE_THRESHOLD} 堂以下`}
          to={`/coach/students?coach=${coach.id}&sort=balance`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="學員" description={`${students.length} 位`} />
          {students.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {students.map((s) => {
                const bal = selectBalance(data, s.id)
                const last = selectCompleted(data, s.id)[0]
                return (
                  <li key={s.id}>
                    <Link to={`/coach/students/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                      <Avatar name={s.name} id={s.id} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                          {s.name}
                          {s.status === 'inactive' && <Badge>暫停</Badge>}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          <span className={bal.remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : ''}>剩 {bal.remaining} 堂</span>・上次 {last ? relativeDay(workoutDate(last)) : '尚無'}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ink-300" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState compact icon={Users} title="還沒有學員" description="可以在學員頁新增學員，或從其他教練轉來。" />
          )}
        </Card>

        <Card>
          <CardHeader
            title="本週課程"
            action={
              <Link to={`/coach/schedule?coach=${coach.id}`} className="text-xs font-medium text-accent-700 hover:underline">
                完整課表
              </Link>
            }
          />
          {week.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {week.map((a) => (
                <li key={a.id} className={`flex items-center gap-3 px-5 py-3 ${a.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <span className="tabular w-24 shrink-0 text-[13px] text-ink-700">
                    {formatDate(a.startAt, { weekday: true })}
                    <span className="block font-semibold text-ink-900">
                      {formatTime(a.startAt)}–{formatTime(new Date(endOf(a)))}
                    </span>
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm text-ink-900 ${a.status === 'cancelled' ? 'line-through' : ''}`}>
                    {selectStudent(data, a.studentId)?.name}
                  </span>
                  {a.status === 'cancelled' && <Badge>已取消</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={CalendarDays} title="本週沒有課程" />
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="最近上課紀錄" description={`${coach.name} 實際上的教練課`} />
        {taught.length ? (
          <div className="divide-y divide-line border-t border-line">
            {taught.map((w) => (
              <WorkoutRow key={w.id} workout={w} showStudent showDeduction onOpen={() => setOpen(w)} />
            ))}
          </div>
        ) : (
          <EmptyState compact icon={Check} title="還沒有上課紀錄" />
        )}
      </Card>
      <WorkoutDetailModal workout={open} onClose={() => setOpen(null)} audience="coach" />
    </div>
  )
}
