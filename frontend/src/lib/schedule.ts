import type { Appointment } from '../types'

export const endOf = (a: Pick<Appointment, 'startAt' | 'durationMin'>) => new Date(a.startAt).getTime() + a.durationMin * 60_000

/** Scheduled appointments that overlap the candidate's time slot (the coach can only be in one place). */
export function findConflicts(all: Appointment[], candidate: Pick<Appointment, 'id' | 'startAt' | 'durationMin'>) {
  const start = new Date(candidate.startAt).getTime()
  const end = endOf(candidate)
  return all.filter((a) => a.id !== candidate.id && a.status === 'scheduled' && new Date(a.startAt).getTime() < end && endOf(a) > start)
}

/** Same weekday and time on each of the next `weeks` weeks, starting with `first`. */
export function weeklySeries(first: Date, weeks: number) {
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(first)
    d.setDate(d.getDate() + i * 7)
    return d
  })
}

export const STATUS_LABEL: Record<Appointment['status'], string> = {
  scheduled: '已排定',
  completed: '已完成',
  cancelled: '已取消',
}
