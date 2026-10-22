// Thin fetch wrapper for the Lift More More backend. Enabled when VITE_API_URL is set
// (e.g. http://localhost:8080/api); otherwise the app runs as an offline demo.

export const API_URL: string | undefined = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || undefined
export const isApiMode = Boolean(API_URL)

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network', '無法連線到伺服器，請確認網路或稍後再試')
  }
  const text = await res.text()
  const json = text ? safeParse(text) : null
  if (!res.ok) {
    const err = (json ?? {}) as { code?: string; message?: string }
    throw new ApiError(res.status, err.code ?? 'http_' + res.status, err.message ?? `伺服器錯誤（${res.status}）`)
  }
  return json as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export interface AuthResponse {
  token: string
  expiresAt: string
  user: { userId: string; role: 'coach' | 'student'; name: string; email: string; coachId: string; studentId?: string }
}
