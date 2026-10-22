import { useMemo } from 'react'
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

/** The student the demo is currently signed in as (student role only). */
export function useCurrentStudent() {
  const { data } = useData()
  const { session } = useSession()
  return session?.role === 'student' ? selectStudent(data, session.studentId) : undefined
}
