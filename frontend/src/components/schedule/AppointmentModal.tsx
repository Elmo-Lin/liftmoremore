import { CalendarX2, RotateCcw, Trash2, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDate, formatTime, toDateInput } from '../../lib/format'
import { uid } from '../../lib/id'
import { findConflicts, weeklySeries } from '../../lib/schedule'
import { validateAppointment } from '../../store/actions'
import { useData, useToast } from '../../store/contexts'
import type { Appointment, ID } from '../../types'
import { Button } from '../ui/Button'
import { SelectInput, TextInput } from '../ui/Form'
import { ConfirmDialog, Modal } from '../ui/Modal'

const DURATIONS = [30, 45, 60, 75, 90, 120]
const REPEAT_WEEKS = [1, 2, 4, 8, 12]

/** New appointment: pass `defaults` (e.g. the day that was tapped). Existing: pass `appointment`. */
export function AppointmentModal({
  open,
  onClose,
  appointment,
  defaults,
}: {
  open: boolean
  onClose: () => void
  appointment?: Appointment
  defaults?: { date?: Date; studentId?: ID }
}) {
  if (!open) return null
  return <AppointmentForm key={appointment?.id ?? 'new'} onClose={onClose} appointment={appointment} defaults={defaults} />
}

function AppointmentForm({ onClose, appointment, defaults }: { onClose: () => void; appointment?: Appointment; defaults?: { date?: Date; studentId?: ID } }) {
  const { data, actions } = useData()
  const notify = useToast()
  const students = data.students.filter((s) => s.status === 'active' || s.id === appointment?.studentId)
  // New appointments reuse the most recent location, so a coach with one studio types it once.
  const lastLocation = [...data.appointments].sort((a, b) => b.startAt.localeCompare(a.startAt))[0]?.location ?? data.coach.studio

  const [form, setForm] = useState(() => {
    const start = appointment ? new Date(appointment.startAt) : nextSlot(defaults?.date)
    return {
      studentId: appointment?.studentId ?? defaults?.studentId ?? '',
      date: toDateInput(start),
      time: formatTime(start),
      durationMin: appointment?.durationMin ?? 60,
      location: appointment?.location ?? lastLocation ?? '',
      weeks: 1,
    }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const startAt = useMemo(() => {
    const [y, m, d] = form.date.split('-').map(Number)
    const [hh, mm] = form.time.split(':').map(Number)
    const x = new Date(y, m - 1, d, hh, mm)
    return Number.isNaN(x.getTime()) ? '' : x.toISOString()
  }, [form.date, form.time])

  const slots = useMemo(() => (startAt ? weeklySeries(new Date(startAt), appointment ? 1 : form.weeks) : []), [startAt, form.weeks, appointment])
  const conflicts = useMemo(
    () =>
      slots.flatMap((d) =>
        findConflicts(data.appointments, { id: appointment?.id ?? '', startAt: d.toISOString(), durationMin: form.durationMin }).map((c) => ({ at: d, with: c })),
      ),
    [slots, data.appointments, appointment, form.durationMin],
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateAppointment({ studentId: form.studentId, startAt, durationMin: form.durationMin, location: form.location })
    setErrors(errs)
    if (Object.keys(errs).length) return
    const list: Appointment[] = slots.map((d, i) => ({
      id: appointment && i === 0 ? appointment.id : uid('apt'),
      coachId: data.coach.id,
      studentId: form.studentId,
      startAt: d.toISOString(),
      durationMin: form.durationMin,
      location: form.location,
      status: appointment?.status ?? 'scheduled',
    }))
    const res = actions.saveAppointments(list)
    if (!res.ok) return notify(res.error, 'error')
    notify(appointment ? '課程已更新' : list.length > 1 ? `已安排 ${list.length} 堂課` : '課程已安排')
    onClose()
  }

  const setStatus = (status: Appointment['status']) => {
    if (!appointment) return
    const res = actions.saveAppointments([{ ...appointment, status }])
    if (!res.ok) return notify(res.error, 'error')
    notify(status === 'cancelled' ? '課程已取消' : '課程已恢復')
    onClose()
  }

  const remove = () => {
    if (!appointment) return
    const res = actions.deleteAppointment(appointment.id)
    if (!res.ok) return notify(res.error, 'error')
    notify('課程已刪除', 'info')
    onClose()
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={appointment ? '編輯課程' : '安排課程'}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} className="h-11 md:h-10">
              取消
            </Button>
            <Button type="submit" form="appointment-form" className="h-11 md:h-10">
              {appointment ? '儲存變更' : form.weeks > 1 ? `安排 ${form.weeks} 堂` : '安排課程'}
            </Button>
          </>
        }
      >
        <form id="appointment-form" onSubmit={submit} noValidate className="grid grid-cols-2 gap-4">
          <SelectInput label="學員" required containerClassName="col-span-2" value={form.studentId} onChange={(e) => set('studentId', e.target.value)} error={errors.studentId}>
            <option value="">選擇學員</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
          <TextInput label="日期" required type="date" value={form.date} onChange={(e) => set('date', e.target.value)} error={errors.startAt} />
          <TextInput label="時間" required type="time" step={900} value={form.time} onChange={(e) => set('time', e.target.value)} />
          <SelectInput label="時長" value={form.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} error={errors.durationMin}>
            {[...new Set([...DURATIONS, form.durationMin])].sort((a, b) => a - b).map((n) => (
              <option key={n} value={n}>
                {n} 分鐘
              </option>
            ))}
          </SelectInput>
          {!appointment && (
            <SelectInput label="重複" value={form.weeks} onChange={(e) => set('weeks', Number(e.target.value))}>
              {REPEAT_WEEKS.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? '不重複' : `每週，共 ${n} 週`}
                </option>
              ))}
            </SelectInput>
          )}
          <TextInput
            label="地點"
            required
            containerClassName="col-span-2"
            maxLength={80}
            placeholder="例如：工作室、某某健身房"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            error={errors.location}
          />
          {conflicts.length > 0 && (
            <div className="col-span-2 flex gap-2 rounded-lg bg-warn-50 px-3 py-2.5 text-[13px] text-warn-600" role="status">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">時間與其他課程重疊，仍可儲存</p>
                <ul className="mt-0.5">
                  {conflicts.slice(0, 3).map((c) => (
                    <li key={c.with.id + c.at.toISOString()}>
                      {formatDate(c.at, { weekday: true })} {formatTime(c.with.startAt)}・{data.students.find((s) => s.id === c.with.studentId)?.name}
                    </li>
                  ))}
                  {conflicts.length > 3 && <li>還有 {conflicts.length - 3} 堂…</li>}
                </ul>
              </div>
            </div>
          )}
        </form>

        {appointment && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            {appointment.status === 'cancelled' ? (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setStatus('scheduled')}>
                恢復課程
              </Button>
            ) : (
              <Button variant="ghost" size="sm" icon={CalendarX2} onClick={() => setStatus('cancelled')}>
                取消這堂課
              </Button>
            )}
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              刪除
            </Button>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="刪除這堂課？"
        description="刪除後學員的課表上也不會再顯示。若只是這次不上，建議改用「取消這堂課」保留紀錄。"
        confirmLabel="刪除"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

/** Default start for a new appointment: the next whole hour, on the tapped day if one was given. */
function nextSlot(day?: Date) {
  const now = new Date()
  const x = day ? new Date(day) : new Date(now)
  x.setHours(day && day.toDateString() !== now.toDateString() ? 19 : now.getHours() + 1, 0, 0, 0)
  return x
}
