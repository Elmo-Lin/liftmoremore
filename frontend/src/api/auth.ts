import { generateMockData } from '../data/mock'
import type { DemoSession, Role } from '../types'
import { api, ApiError, type AuthResponse } from './client'

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

export async function registerSelf(input: { name: string; email: string; password: string }) {
  return toSession(await api<AuthResponse>('POST', '/auth/register-self', input))
}

export async function activateInvite(inviteCode: string, password: string) {
  return toSession(await api<AuthResponse>('POST', '/auth/activate', { inviteCode, password }))
}

/** Replace the server's data with freshly generated demo data (demo servers only). */
export async function importDemoData() {
  await api('POST', '/demo/import', generateMockData())
}

/** One-click demo sign-in; seeds the server with demo data on first use. */
export async function demoLogin(role: Role, studentId?: string): Promise<DemoSession> {
  try {
    return toSession(await api<AuthResponse>('POST', '/demo/login', { role, studentId }))
  } catch (e) {
    if (e instanceof ApiError && e.code === 'demo_not_seeded') {
      await importDemoData()
      return toSession(await api<AuthResponse>('POST', '/demo/login', { role, studentId }))
    }
    if (e instanceof ApiError && e.status === 404) throw new ApiError(404, 'demo_disabled', '此伺服器未開啟示範模式，請用帳號密碼登入')
    throw e
  }
}

export async function createInvite(studentId: string, token: string) {
  return api<{ inviteCode: string; expiresAt: string }>('POST', `/students/${studentId}/invite`, undefined, token)
}
