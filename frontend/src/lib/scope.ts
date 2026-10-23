import type { AppData, ID } from '../types'

/**
 * Offline demo only: what a studio coach sees, mirroring the server's scoping — their own students
 * and those students' records, the shared plans, and their own profile as "the coach".
 */
export function viewAsCoach(d: AppData, coachId: ID): AppData {
  const me = d.studio?.coaches.find((c) => c.id === coachId)
  if (!me) return d
  const mine = new Set(d.relationships.filter((r) => r.coachId === coachId).map((r) => r.studentId))
  const own = <T extends { studentId: ID }>(list: T[]) => list.filter((x) => mine.has(x.studentId))
  return {
    ...d,
    coach: { id: me.id, role: 'coach', name: me.name, email: me.email, title: me.title ?? '教練', studio: d.coach.studio, createdAt: me.createdAt },
    students: d.students.filter((s) => mine.has(s.id)),
    relationships: own(d.relationships),
    workouts: own(d.workouts),
    packages: own(d.packages),
    transactions: own(d.transactions),
    metrics: own(d.metrics),
    appointments: own(d.appointments),
    studio: d.studio && { ...d.studio, coaches: d.studio.coaches.map((c) => ({ ...c, inviteCode: undefined })) },
  }
}
