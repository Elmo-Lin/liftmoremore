// Session balance derivation. Balances are never stored — they are always
// computed from SessionPackage.totalSessions + Σ SessionTransaction.delta,
// so there is exactly one source of truth.
import type { ID, SessionPackage, SessionTransaction, WorkoutSession } from '../types'

export const LOW_BALANCE_THRESHOLD = 3

export interface PackageBalance {
  pkg: SessionPackage
  total: number
  /** Sessions consumed by deductions. */
  used: number
  /** Net manual adjustments (+ adds sessions, − removes). */
  adjusted: number
  remaining: number
  transactions: SessionTransaction[]
}

export function packageBalance(pkg: SessionPackage, allTx: SessionTransaction[]): PackageBalance {
  const transactions = allTx
    .filter((t) => t.packageId === pkg.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  let used = 0
  let adjusted = 0
  for (const t of transactions) {
    if (t.type === 'adjustment') adjusted += t.delta
    else used -= t.delta
  }
  return { pkg, total: pkg.totalSessions, used, adjusted, remaining: pkg.totalSessions + adjusted - used, transactions }
}

export interface StudentBalance {
  remaining: number
  totalPurchased: number
  used: number
  packages: PackageBalance[]
  /** Package the next deduction would come from (oldest with sessions left). */
  nextPackage?: PackageBalance
}

export function studentBalance(
  studentId: ID,
  packages: SessionPackage[],
  transactions: SessionTransaction[],
): StudentBalance {
  const balances = packages
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
    .map((p) => packageBalance(p, transactions))
  return {
    remaining: balances.reduce((s, b) => s + b.remaining, 0),
    totalPurchased: balances.reduce((s, b) => s + b.total, 0),
    used: balances.reduce((s, b) => s + b.used, 0),
    packages: balances,
    nextPackage: balances.find((b) => b.remaining > 0),
  }
}

/** The active (not reversed) deduction for a workout, if any. */
export function deductionFor(workoutId: ID, transactions: SessionTransaction[]) {
  const linked = transactions.filter((t) => t.workoutSessionId === workoutId)
  const net = linked.reduce((s, t) => s + t.delta, 0)
  if (net >= 0) return undefined
  return linked.filter((t) => t.type === 'deduction').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/** Why a workout cannot be deducted, or null when it can. */
export function deductionBlocker(
  workout: WorkoutSession,
  balance: StudentBalance,
  transactions: SessionTransaction[],
): string | null {
  if (workout.type !== 'coached') return '自主訓練不會扣除教練課堂數'
  if (workout.status !== 'completed') return '請先完成訓練再扣堂'
  if (deductionFor(workout.id, transactions)) return '此堂課已扣除'
  if (!balance.nextPackage) return '剩餘堂數不足，請先新增課程方案'
  return null
}
