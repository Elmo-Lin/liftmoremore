import type { AppData, ID } from '../types'
import { addDays, startOfWeek } from './format'
import { LOW_BALANCE_THRESHOLD, studentBalance } from './sessions'
import { workoutDate } from './stats'

/** IDs of the students a coach is responsible for. */
export const studentIdsOf = (d: AppData, coachId: ID) => new Set(d.relationships.filter((r) => r.coachId === coachId).map((r) => r.studentId))

/** One coach's numbers, as the studio owner sees them (studio page and coach page agree). */
export function coachStats(d: AppData, coachId: ID, now = new Date()) {
  const ids = studentIdsOf(d, coachId)
  const students = d.students.filter((s) => ids.has(s.id))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekStart = startOfWeek(now).getTime()
  const weekEnd = addDays(startOfWeek(now), 7).getTime()
  return {
    students: students.filter((s) => s.status === 'active').length,
    sessions: d.workouts.filter((w) => ids.has(w.studentId) && w.type === 'coached' && w.status === 'completed' && new Date(workoutDate(w)) >= monthStart).length,
    low: students.filter((s) => s.status === 'active' && studentBalance(s.id, d.packages, d.transactions).remaining <= LOW_BALANCE_THRESHOLD).length,
    thisWeek: d.appointments.filter((a) => {
      const t = new Date(a.startAt).getTime()
      return ids.has(a.studentId) && a.status !== 'cancelled' && t >= weekStart && t < weekEnd
    }).length,
  }
}
