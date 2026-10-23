import { CalendarPlus, ChevronLeft, ChevronRight, Play, Plus } from 'lucide-react'
import { useState } from 'react'
import { AppointmentModal } from '../../components/schedule/AppointmentModal'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { Avatar, Badge, Card, DemoNotice, PageHeader } from '../../components/ui/Primitives'
import { addDays, formatDate, formatTime, isSameDay, startOfWeek } from '../../lib/format'
import { endOf, STATUS_LABEL } from '../../lib/schedule'
import { useData } from '../../store/contexts'
import { selectStudent } from '../../store/selectors'
import type { Appointment } from '../../types'

const WEEKDAY = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

/** Coach's class timetable: one week at a time, a day per row, tap a class to edit it. */
export function CoachSchedulePage() {
  const { data } = useData()
  const [weekOffset, setWeekOffset] = useState(0)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [creating, setCreating] = useState<{ date?: Date } | null>(null)

  const today = new Date()
  const weekStart = addDays(startOfWeek(today), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const from = weekStart.getTime()
  const to = addDays(weekStart, 7).getTime()
  const inWeek = data.appointments
    .filter((a) => {
      const t = new Date(a.startAt).getTime()
      return t >= from && t < to
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  const scheduled = inWeek.filter((a) => a.status !== 'cancelled').length
  const cancelled = inWeek.length - scheduled

  return (
    <div>
      <PageHeader
        title="課表"
        description="安排與查看每週的上課時間"
        actions={
          <Button icon={CalendarPlus} onClick={() => setCreating({})}>
            安排課程
          </Button>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        <IconButton icon={ChevronLeft} label="上一週" onClick={() => setWeekOffset((w) => w - 1)} />
        <p className="tabular min-w-0 flex-1 text-center text-[15px] font-semibold text-ink-900 sm:flex-none">
          {formatDate(weekStart, { year: weekStart.getFullYear() !== today.getFullYear() })} – {formatDate(addDays(weekStart, 6))}
        </p>
        <IconButton icon={ChevronRight} label="下一週" onClick={() => setWeekOffset((w) => w + 1)} />
        {weekOffset !== 0 && (
          <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>
            本週
          </Button>
        )}
      </div>
      <p className="mb-4 text-[13px] text-ink-500">
        {weekOffset === 0 ? '本週' : weekOffset === 1 ? '下週' : weekOffset === -1 ? '上週' : '這週'} {scheduled} 堂課{cancelled ? `・已取消 ${cancelled} 堂` : ''}
      </p>

      <Card className="divide-y divide-line">
        {days.map((day, i) => {
          const list = inWeek.filter((a) => isSameDay(a.startAt, day))
          const isToday = isSameDay(day, today)
          return (
            <section key={day.toISOString()} className="flex gap-2 px-3 py-3 sm:gap-5 sm:px-5" aria-label={`${WEEKDAY[i]} ${formatDate(day)}`}>
              <div className="w-10 shrink-0 pt-1 text-center sm:w-12">
                <p className={`text-xs ${isToday ? 'font-semibold text-accent-700' : 'text-ink-500'}`}>{isToday ? '今天' : WEEKDAY[i]}</p>
                <p className={`tabular mt-0.5 text-[17px] font-semibold ${isToday ? 'text-accent-700' : 'text-ink-900'}`}>{day.getDate()}</p>
              </div>
              <div className="min-w-0 flex-1">
                {list.length ? (
                  <ul className="space-y-1.5">
                    {list.map((a) => (
                      <AppointmentRow key={a.id} appointment={a} onOpen={() => setEditing(a)} showStart={isToday} />
                    ))}
                  </ul>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating({ date: day })}
                    className="flex h-10 w-full items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-400 transition-colors hover:bg-subtle hover:text-accent-700"
                    aria-label={`在 ${formatDate(day)} 安排課程`}
                  >
                    <Plus className="size-4" />
                    沒有課程
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </Card>
      <DemoNotice className="mt-6" />

      <AppointmentModal open={!!creating} onClose={() => setCreating(null)} defaults={creating ?? undefined} />
      <AppointmentModal open={!!editing} onClose={() => setEditing(null)} appointment={editing ?? undefined} />
    </div>
  )
}

function AppointmentRow({ appointment: a, onOpen, showStart }: { appointment: Appointment; onOpen: () => void; showStart: boolean }) {
  const { data } = useData()
  const s = selectStudent(data, a.studentId)
  const cancelled = a.status === 'cancelled'
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-subtle ${cancelled ? 'opacity-60' : 'bg-canvas'}`}
      >
        <span className="tabular w-11 shrink-0 text-[13px] leading-tight text-ink-800">
          <span className={`block font-semibold ${cancelled ? 'line-through' : ''}`}>{formatTime(a.startAt)}</span>
          <span className="block text-ink-500">{formatTime(new Date(endOf(a)))}</span>
        </span>
        <span className="hidden sm:contents">
          <Avatar name={s?.name ?? '?'} id={a.studentId} size="sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium text-ink-900 ${cancelled ? 'line-through' : ''}`}>{s?.name ?? '已刪除的學員'}</span>
          <span className="block truncate text-xs text-ink-500">
            {a.location}・{a.durationMin} 分鐘
          </span>
        </span>
        {a.status !== 'scheduled' && <Badge tone={cancelled ? 'neutral' : 'accent'}>{STATUS_LABEL[a.status]}</Badge>}
      </button>
      {showStart && a.status === 'scheduled' && s && (
        <ButtonLink to={`/coach/workouts/new?student=${s.id}`} variant="secondary" size="sm" icon={Play} aria-label={`開始記錄 ${s.name}`}>
          <span className="hidden sm:inline">開始</span>
        </ButtonLink>
      )}
    </li>
  )
}
