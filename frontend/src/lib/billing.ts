// Prices and limits. Mirrors backend billing/Plans.java (the server enforces them).
import type { AppData, Billing, BillingStatus, PlanId } from '../types'

export const TRIAL_DAYS = 10

export const PLANS: Record<PlanId, { name: string; price: number; students: number; coaches: number }> = {
  pro: { name: '自由教練 Pro', price: 399, students: 30, coaches: 1 },
  team: { name: '工作室 Team', price: 999, students: 100, coaches: 3 },
}

export const STUDENT_PACK = { size: 10, price: 99 }
export const COACH_SEAT_PRICE = 199
export const MAX_STUDENT_PACKS = 100
export const MAX_COACH_SEATS = 50

export const STATUS_LABEL: Record<BillingStatus, string> = {
  trialing: '免費試用中',
  active: '訂閱中',
  past_due: '扣款失敗',
  canceled: '已取消（本期仍可使用）',
  expired: '已到期・唯讀',
}

/** Extra coach seats exist only on Team. */
export const monthlyPrice = (plan: PlanId, packs: number, seats: number) =>
  PLANS[plan].price + packs * STUDENT_PACK.price + (plan === 'team' ? seats * COACH_SEAT_PRICE : 0)

export const studentLimit = (plan: PlanId, packs: number) => PLANS[plan].students + packs * STUDENT_PACK.size
export const coachLimit = (plan: PlanId, seats: number) => PLANS[plan].coaches + (plan === 'team' ? seats : 0)

/** Estimated prorated charge for an upgrade: the monthly difference times what is left of the period. */
export function prorate(monthlyDelta: number, periodEnd: string | undefined, now = new Date()) {
  if (monthlyDelta <= 0 || !periodEnd) return 0
  const end = new Date(periodEnd)
  const start = new Date(end)
  start.setMonth(start.getMonth() - 1)
  const left = (end.getTime() - now.getTime()) / (end.getTime() - start.getTime())
  return left <= 0 ? 0 : Math.ceil(monthlyDelta * Math.min(1, left))
}

/** Whole days left (rounded up), never negative. */
export const daysLeft = (iso: string, now = new Date()) => Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000))

/** Active students in the whole workspace, including ones the caller cannot see. */
export const activeStudentsOf = (d: AppData) => (d.billing?.hiddenActiveStudents ?? 0) + d.students.filter((s) => s.status === 'active').length

export const limitMessage = (b: Billing) =>
  `活躍學員已達方案上限（${b.studentLimit} 位）。` + (b.canManage ? '請至「方案與付款」加購名額，或將已結案的學員設為停用。' : '請聯絡工作室經營者加購名額。')

export const readOnlyMessage = (b: Billing) =>
  b.canManage ? '方案已到期，目前為唯讀。訂閱後即可繼續新增與編輯，資料都還在。' : '工作室的方案已到期，目前為唯讀。請聯絡工作室經營者。'
