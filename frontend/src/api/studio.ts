// Studio management calls that need the server's answer (invite codes, a new token), so they are
// made directly instead of through the local action + sync queue.
import type { CoachMember, DemoSession } from '../types'
import { api, type AuthResponse } from './client'

export interface CoachInvite {
  coach: CoachMember
  inviteCode: string
  expiresAt: string
}

export function inviteCoach(input: { name: string; email: string; title?: string }, token: string) {
  return api<CoachInvite>('POST', '/studio/coaches', input, token)
}

export function reinviteCoach(coachId: string, token: string) {
  return api<CoachInvite>('POST', `/studio/coaches/${coachId}/invite`, undefined, token)
}

/** A studio coach leaves to become a free coach (their students stay); the new token carries the new workspace. */
export async function leaveStudio(token: string): Promise<DemoSession> {
  const r = await api<AuthResponse>('POST', '/studio/leave', undefined, token)
  return { role: r.user.role, studentId: r.user.studentId ?? '', token: r.token, name: r.user.name }
}

/** A free coach becomes a studio owner; the new token carries the new role. */
export async function upgradeToStudio(studio: string, token: string): Promise<DemoSession> {
  const r = await api<AuthResponse>('POST', '/studio/upgrade', { studio }, token)
  return { role: r.user.role, studentId: r.user.studentId ?? '', token: r.token, name: r.user.name }
}
