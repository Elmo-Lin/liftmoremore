// Maps each local store action to the backend request(s) that persist it.
// The local action runs first (instant UI + the same validation the server does);
// the request is then queued. IDs are generated on the client and accepted by the
// server, so local and server state stay identical.
import type { DataActions } from '../store/actions'
import type { AppData, Appointment, SessionPackage, Student } from '../types'

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: unknown
}

type Name = keyof DataActions

const studentBody = (s: Student) => ({
  id: s.id,
  name: s.name,
  email: s.email,
  phone: s.phone ?? '',
  gender: s.gender,
  birthYear: s.birthYear ?? null,
  heightCm: s.heightCm ?? null,
  goal: s.goal,
  goalDetail: s.goalDetail,
  weeklyFrequency: s.weeklyFrequency,
  coachNotes: s.coachNotes,
  status: s.status,
  activePlanId: s.activePlanId ?? null,
})

const packageBody = (p: SessionPackage) => ({
  id: p.id,
  name: p.name,
  totalSessions: p.totalSessions,
  priceTwd: p.priceTwd,
  purchaseDate: p.purchaseDate,
  expiresAt: p.expiresAt ?? null,
  notes: p.notes ?? null,
})

const newTransactions = (before: AppData, after: AppData) => {
  const seen = new Set(before.transactions.map((t) => t.id))
  return after.transactions.filter((t) => !seen.has(t.id))
}

/** Requests that persist a successful local action, or null if it needs no sync. */
export function requestsFor(name: Name, args: unknown[], value: unknown, before: AppData, after: AppData): ApiRequest[] | null {
  switch (name) {
    case 'resetDemo':
      return [{ method: 'POST', path: '/demo/import', body: after }]
    case 'addStudent': {
      const s = value as Student
      const coachId = after.relationships.find((r) => r.studentId === s.id)?.coachId
      return [{ method: 'POST', path: '/students', body: { ...studentBody(s), coachId: coachId !== after.coach.id ? coachId : undefined } }]
    }
    case 'transferStudent':
      return [{ method: 'PUT', path: `/students/${args[0]}/coach`, body: { coachId: args[1] } }]
    case 'deactivateCoach':
      return [{ method: 'POST', path: `/studio/coaches/${args[0]}/deactivate`, body: { transferTo: args[1] ?? null } }]
    case 'updateStudent': {
      const s = after.students.find((x) => x.id === args[0])
      return s ? [{ method: 'PUT', path: `/students/${s.id}`, body: studentBody(s) }] : null
    }
    case 'deleteStudent':
      return [{ method: 'DELETE', path: `/students/${args[0]}` }]
    case 'savePlan':
    case 'duplicatePlan': {
      const p = value as AppData['plans'][number]
      return [{ method: 'PUT', path: `/plans/${p.id}`, body: p }]
    }
    case 'deletePlan':
      return [{ method: 'DELETE', path: `/plans/${args[0]}` }]
    case 'assignPlan':
      return [{ method: 'PUT', path: `/plans/${args[0]}/assignments`, body: { studentIds: args[1] } }]
    case 'saveWorkout': {
      const w = value as AppData['workouts'][number]
      return [{ method: 'PUT', path: `/workouts/${w.id}`, body: w }]
    }
    case 'deleteWorkout':
      return [{ method: 'DELETE', path: `/workouts/${args[0]}` }]
    case 'deductSession': {
      const tx = newTransactions(before, after)[0]
      return [{ method: 'POST', path: `/workouts/${args[0]}/deduction`, body: { transactionId: tx?.id } }]
    }
    case 'reverseDeduction': {
      const tx = newTransactions(before, after)[0]
      return [{ method: 'POST', path: `/workouts/${args[0]}/deduction/reversal`, body: { transactionId: tx?.id, reason: tx?.reason ?? String(args[1]) } }]
    }
    case 'addPackage':
      return [{ method: 'POST', path: `/students/${args[0]}/packages`, body: packageBody(value as SessionPackage) }]
    case 'updatePackage': {
      const p = after.packages.find((x) => x.id === args[0])
      return p ? [{ method: 'PUT', path: `/packages/${p.id}`, body: packageBody(p) }] : null
    }
    case 'saveAppointments':
      return (value as Appointment[]).map((a) => ({ method: 'PUT' as const, path: `/appointments/${a.id}`, body: a }))
    case 'deleteAppointment':
      return [{ method: 'DELETE', path: `/appointments/${args[0]}` }]
    case 'deletePackage':
      return [{ method: 'DELETE', path: `/packages/${args[0]}` }]
    case 'savePackagePresets':
      return [{ method: 'PUT', path: '/me/package-presets', body: { presets: value } }]
    case 'adjustPackage': {
      const tx = newTransactions(before, after)[0]
      return [{ method: 'POST', path: `/packages/${args[0]}/adjustments`, body: { id: tx?.id, delta: args[1], reason: tx?.reason ?? args[2] } }]
    }
  }
  return null
}
