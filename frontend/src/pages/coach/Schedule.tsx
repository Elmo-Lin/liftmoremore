import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play, Plus } from 'lucide-react'
import { useState } from 'react'
import { AppointmentModal } from '../../components/schedule/AppointmentModal'
import { useRescheduleDrag, type DragState } from '../../components/schedule/useRescheduleDrag'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { Avatar, Badge, Card, DemoNotice, PageHeader } from '../../components/ui/Primitives'
import { addDays, formatDate, formatTime, isSameDay, startOfWeek, toDateInput } from '../../lib/format'
import { endOf, findConflicts, STATUS_LABEL } from '../../lib/schedule'
import { useData, useToast } from '../../store/contexts'
import { selectStudent } from '../../store/selectors'
import type { Appointment } from '../../types'

const WEEKDAY = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

/** Coach's class timetable: one week at a time, a day per row. Tap a class to edit it, drag it to move it. */
export function CoachSchedulePage() {
  const { data, actions } = useData()
  const notify = useToast()
  const [weekOffset, setWeekOffset] = useState(0)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [creating, setCreating] = useState<{ date?: Date } | null>(null)

  // Moving keeps the time of day and only changes the date.
  const { drag, start, consumeClick } = useRescheduleDrag({
    onFlipWeek: (dir) => setWeekOffset((w) => w + dir),
    onDrop: (a, day) => {
      const from = new Date(a.startAt)
      if (toDateInput(from) === day) return
      const [y, m, d] = day.split('-').map(Number)
      const to = new Date(y, m - 1, d, from.getHours(), from.getMinutes())
      const moved = { ...a, startAt: to.toISOString() }
      const res = actions.saveAppointments([moved])
      if (!res.ok) return notify(res.error, 'error')
      const name = data.students.find((s) => s.id === a.studentId)?.name ?? ''
      const overlap = findConflicts(data.appointments, moved).length > 0
      notify(`${name} 已移到 ${formatDate(to, { weekday: true })} ${formatTime(to)}${overlap ? '・與其他課程時間重疊' : ''}`, overlap ? 'info' : 'success')
    },
  })

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
        <span className="text-ink-400">・長按或拖曳課程可改日期</span>
      </p>

      <Card className="divide-y divide-line">
        {days.map((day, i) => {
          const list = inWeek.filter((a) => isSameDay(a.startAt, day))
          const isToday = isSameDay(day, today)
          return (
            <section
              key={day.toISOString()}
              data-drop={toDateInput(day)}
              className={`flex gap-2 px-3 py-3 transition-colors sm:gap-5 sm:px-5 ${drag?.over === toDateInput(day) ? 'bg-accent-50' : ''}`}
              aria-label={`${WEEKDAY[i]} ${formatDate(day)}`}
            >
              <div className="w-10 shrink-0 pt-1 text-center sm:w-12">
                <p className={`text-xs ${isToday ? 'font-semibold text-accent-700' : 'text-ink-500'}`}>{isToday ? '今天' : WEEKDAY[i]}</p>
                <p className={`tabular mt-0.5 text-[17px] font-semibold ${isToday ? 'text-accent-700' : 'text-ink-900'}`}>{day.getDate()}</p>
              </div>
              <div className="min-w-0 flex-1">
                {list.length ? (
                  <ul className="space-y-1.5">
                    {list.map((a) => (
                      <AppointmentRow
                        key={a.id}
                        appointment={a}
                        showStart={isToday}
                        dragging={drag?.appointment.id === a.id}
                        onPointerDown={(e) => start(e, a)}
                        onOpen={() => !consumeClick() && setEditing(a)}
                      />
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
      {drag && <DragOverlay drag={drag} />}

      <AppointmentModal open={!!creating} onClose={() => setCreating(null)} defaults={creating ?? undefined} />
      <AppointmentModal open={!!editing} onClose={() => setEditing(null)} appointment={editing ?? undefined} />
    </div>
  )
}

/** While dragging: the class following the pointer, plus "previous / next week" zones at the screen edges. */
function DragOverlay({ drag }: { drag: DragState }) {
  const { data } = useData()
  const a = drag.appointment
  const zone = (dir: 'prev' | 'next') =>
    `fixed inset-x-0 z-50 flex h-14 items-center justify-center gap-1.5 text-sm font-medium transition-colors md:left-60 ${
      drag.over === dir ? 'bg-accent-600 text-white' : 'bg-accent-50/95 text-accent-700 backdrop-blur'
    }`
  return (
    <>
      <div data-drop="prev" className={`${zone('prev')} top-12 border-b border-accent-100 md:top-0`}>
        <ChevronUp className="size-4" />
        停在這裡切換到上一週
      </div>
      <div data-drop="next" className={`${zone('next')} bottom-[calc(50px+env(safe-area-inset-bottom))] border-t border-accent-100 md:bottom-0`}>
        <ChevronDown className="size-4" />
        停在這裡切換到下一週
      </div>
      <div
        className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-[120%] rounded-lg bg-surface px-3 py-2 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.18)] ring-1 ring-accent-600"
        style={{ left: drag.x, top: drag.y }}
      >
        <span className="tabular font-semibold text-ink-900">{formatTime(a.startAt)}</span>
        <span className="ml-2 text-ink-700">{selectStudent(data, a.studentId)?.name}</span>
      </div>
    </>
  )
}

function AppointmentRow({
  appointment: a,
  onOpen,
  onPointerDown,
  showStart,
  dragging,
}: {
  appointment: Appointment
  onOpen: () => void
  onPointerDown: (e: React.PointerEvent) => void
  showStart: boolean
  dragging: boolean
}) {
  const { data } = useData()
  const s = selectStudent(data, a.studentId)
  const cancelled = a.status === 'cancelled'
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex min-w-0 flex-1 cursor-grab items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors select-none [-webkit-touch-callout:none] hover:bg-subtle ${
          cancelled ? 'opacity-60' : 'bg-canvas'
        } ${dragging ? 'opacity-30' : ''}`}
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
