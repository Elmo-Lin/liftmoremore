import type { Equipment, Gender, MuscleGroup, TrainingGoal } from '../types'

const DAY = 24 * 60 * 60 * 1000
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export const twd = (n: number) => `NT$ ${Math.round(n).toLocaleString('zh-TW')}`

export const kg = (n: number | null | undefined) =>
  n == null ? '—' : `${Number.isInteger(n) ? n : n.toFixed(1)} kg`

/** Training volume, always in kg with thousands separators (e.g. 125,430). */
export const volumeNumber = (n: number) => Math.round(n).toLocaleString('zh-TW')
export const volumeKg = (n: number) => `${volumeNumber(n)} kg`

export function startOfDay(d: Date | string): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Monday-based week start. */
export function startOfWeek(d: Date | string): Date {
  const x = startOfDay(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

export const addDays = (d: Date | string, n: number) => new Date(new Date(d).getTime() + n * DAY)

export const isSameDay = (a: Date | string, b: Date | string) =>
  startOfDay(a).getTime() === startOfDay(b).getTime()

export function daysBetween(a: Date | string, b: Date | string) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)
}

export function formatDate(d: Date | string, opts: { year?: boolean; weekday?: boolean } = {}) {
  const x = new Date(d)
  const base = `${x.getMonth() + 1}/${x.getDate()}`
  const withYear = opts.year ? `${x.getFullYear()}/${base}` : base
  return opts.weekday ? `${withYear}（${WEEKDAYS[x.getDay()]}）` : withYear
}

export function formatTime(d: Date | string) {
  const x = new Date(d)
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

export function formatDateTime(d: Date | string) {
  return `${formatDate(d, { year: true })} ${formatTime(d)}`
}

export function relativeDay(d: Date | string, now = new Date()) {
  const diff = daysBetween(d, now)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === -1) return '明天'
  if (diff > 1 && diff < 7) return `${diff} 天前`
  if (diff < -1 && diff > -7) return `${-diff} 天後`
  return formatDate(d, { year: new Date(d).getFullYear() !== now.getFullYear() })
}

/** yyyy-mm-dd for <input type="date"> in local time. */
export function toDateInput(d: Date | string) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export function fromDateInput(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12).toISOString()
}

export function durationMin(start: string, end?: string) {
  if (!end) return null
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

export const GOAL_LABEL: Record<TrainingGoal, string> = {
  strength: '肌力提升',
  hypertrophy: '增肌',
  fatLoss: '減脂',
  general: '日常體能',
  powerlifting: '健力備賽',
  mobility: '活動度與姿勢',
}

export const GENDER_LABEL: Record<Gender, string> = {
  female: '女',
  male: '男',
  other: '其他',
}

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  legs: '腿部',
  back: '背部',
  chest: '胸部',
  shoulders: '肩部',
  arms: '手臂',
  glutes: '臀部',
  core: '核心',
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: '槓鈴',
  dumbbell: '啞鈴',
  machine: '機械',
  cable: '繩索',
  bodyweight: '自體重',
  kettlebell: '壺鈴',
  other: '其他',
}

export function givenName(name: string) {
  // Chinese names: last 2 chars (林子傑 → 子傑); latin: first word (Elmo Lin → Elmo).
  const trimmed = name.trim()
  if (/[一-鿿]/.test(trimmed)) return trimmed.slice(-2)
  return trimmed.split(/\s+/)[0]
}

export function initials(name: string) {
  // Chinese names: use the given name (last 1-2 chars); latin: first letters.
  if (/[一-鿿]/.test(name)) return name.slice(-2)
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
