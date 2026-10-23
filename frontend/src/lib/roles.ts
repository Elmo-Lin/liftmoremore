import type { Role } from '../types'

/** Coaches and studio owners (owners teach too). */
export const isCoachRole = (role?: Role | null) => role === 'coach' || role === 'owner'

export const homePath = (role?: Role | null) => (isCoachRole(role) ? '/coach' : '/student')

export const ROLE_LABEL: Record<Role, string> = {
  owner: '工作室經營者',
  coach: '教練',
  student: '學員',
  self: '自主訓練',
}
