import type { DemoSession } from '../types'
import { api, type AuthResponse } from './client'

const toSession = (r: AuthResponse): DemoSession => ({
  role: r.user.role,
  studentId: r.user.studentId ?? '',
  token: r.token,
  name: r.user.name,
})

export async function login(email: string, password: string) {
  return toSession(await api<AuthResponse>('POST', '/auth/login', { email, password }))
}

export async function registerCoach(input: { name: string; email: string; password: string; studio?: string }) {
  return toSession(await api<AuthResponse>('POST', '/auth/register', input))
}

export async function registerStudio(input: { name: string; email: string; password: string; studio: string }) {
  return toSession(await api<AuthResponse>('POST', '/auth/register-studio', input))
}

export async function registerSelf(input: { name: string; email: string; password: string }) {
  return toSession(await api<AuthResponse>('POST', '/auth/register-self', input))
}

export async function activateInvite(inviteCode: string, password: string) {
  return toSession(await api<AuthResponse>('POST', '/auth/activate', { inviteCode, password }))
}

export async function createInvite(studentId: string, token: string) {
  return api<{ inviteCode: string; expiresAt: string }>('POST', `/students/${studentId}/invite`, undefined, token)
}

/** Signs in with a Google ID token. A new user gets ApiError 'signup_required' until they send an account type. */
export async function googleSignIn(credential: string, signup?: { accountType: 'self' | 'coach' | 'studio'; studio?: string }) {
  return toSession(await api<AuthResponse>('POST', '/auth/google', { credential, ...signup }))
}

/** A new token for the current role (after a paid upgrade turned a coach into a studio owner). */
export async function refreshSession(token: string) {
  return toSession(await api<AuthResponse>('POST', '/auth/refresh', undefined, token))
}
