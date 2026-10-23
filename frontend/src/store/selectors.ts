import { useMemo } from 'react'
import { isCoachRole } from '../lib/roles'
import { studentBalance } from '../lib/sessions'
import { completedWorkouts } from '../lib/stats'
import type { AppData, Exercise, ID } from '../types'
import { useData, useSession } from './contexts'

export const selectStudent = (d: AppData, id: ID | undefined) => d.students.find((s) => s.id === id)
export const selectPlan = (d: AppData, id: ID | undefined) => (id ? d.plans.find((p) => p.id === id) : undefined)
export const selectBalance = (d: AppData, studentId: ID) => studentBalance(studentId, d.packages, d.transactions)
export const selectCompleted = (d: AppData, studentId?: ID) => completedWorkouts(d.workouts, studentId)
export const selectDrafts = (d: AppData, studentId?: ID, createdBy?: 'coach' | 'student') =>
  d.workouts
    .filter((w) => w.status === 'draft' && (!studentId || w.studentId === studentId) && (!createdBy || w.createdBy === createdBy))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

export const selectNextAppointment = (d: AppData, studentId: ID, now = new Date()) =>
  d.appointments
    .filter((a) => a.studentId === studentId && a.status === 'scheduled' && new Date(a.startAt).getTime() > now.getTime())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0]

export function useExerciseMap() {
  const { data } = useData()
  return useMemo(() => new Map<ID, Exercise>(data.exercises.map((e) => [e.id, e])), [data.exercises])
}

/** The student the demo is currently signed in as (student and self-tracker roles). */
export function useCurrentStudent() {
  const { data } = useData()
  const { session } = useSession()
  return session && !isCoachRole(session.role) ? selectStudent(data, session.studentId) : undefined
}

/** Self-trackers have no coach: hide coached sessions, session balances and assigned plans. */
export function useIsSelf() {
  return useSession().session?.role === 'self'
}

/** The coach responsible for a student (studio owners see every coach's students). */
export const selectCoachOf = (d: AppData, studentId: ID) => d.relationships.find((r) => r.studentId === studentId)?.coachId

export const selectIsStudio = (d: AppData) => d.studio?.kind === 'studio'

/** Coaches who can take students: the owner and activated, not deactivated coaches. */
export const selectActiveCoaches = (d: AppData) => d.studio?.coaches.filter((c) => c.status === 'active') ?? []

export const selectCoachName = (d: AppData, coachId?: ID) => d.studio?.coaches.find((c) => c.id === coachId)?.name ?? (coachId === d.coach.id ? d.coach.name : '')
