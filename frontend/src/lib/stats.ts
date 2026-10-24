// Training statistics. Conventions:
// - Volume = Σ weight × reps over completed sets only.
// - "Top set" = heaviest actually-lifted weight in a workout.
// - Estimated 1RM uses the Epley formula and is always labeled as an estimate.
//   It is only computed for sets of ≤ 10 reps, where the formula is reasonable.
import type { ExerciseLog, ID, SetLog, WorkoutSession } from '../types'
import { startOfWeek } from './format'

export const completedSets = (sets: SetLog[]) =>
  sets.filter((s) => s.completed && s.weightKg != null && s.reps != null && s.reps > 0)

export function setVolume(s: SetLog) {
  return (s.weightKg ?? 0) * (s.reps ?? 0)
}

export function exerciseVolume(log: ExerciseLog) {
  return completedSets(log.sets).reduce((sum, s) => sum + setVolume(s), 0)
}

export function workoutVolume(w: WorkoutSession) {
  return w.exercises.reduce((sum, e) => sum + exerciseVolume(e), 0)
}

export function workoutSetCount(w: WorkoutSession) {
  return w.exercises.reduce((n, e) => n + completedSets(e.sets).length, 0)
}

export function epley1RM(weight: number, reps: number) {
  if (reps <= 0 || reps > 10) return null
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

export function topSet(log: ExerciseLog): SetLog | null {
  const sets = completedSets(log.sets)
  if (!sets.length) return null
  return sets.reduce((best, s) =>
    (s.weightKg ?? 0) > (best.weightKg ?? 0) ||
    ((s.weightKg ?? 0) === (best.weightKg ?? 0) && (s.reps ?? 0) > (best.reps ?? 0))
      ? s
      : best,
  )
}

export function bestE1RM(log: ExerciseLog) {
  let best: number | null = null
  for (const s of completedSets(log.sets)) {
    const e = epley1RM(s.weightKg!, s.reps!)
    if (e != null && (best == null || e > best)) best = e
  }
  return best
}

export const completedWorkouts = (workouts: WorkoutSession[], studentId?: ID) =>
  workouts
    .filter((w) => w.status === 'completed' && (!studentId || w.studentId === studentId))
    .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))

export const workoutDate = (w: WorkoutSession) => w.completedAt ?? w.startedAt

export interface ExercisePoint {
  date: string
  workoutId: ID
  topWeight: number
  topReps: number
  e1rm: number | null
  volume: number
  sets: number
}

/** Per-workout series for one exercise, oldest first. */
export function exerciseSeries(workouts: WorkoutSession[], exerciseId: ID): ExercisePoint[] {
  const points: ExercisePoint[] = []
  for (const w of workouts) {
    if (w.status !== 'completed') continue
    const logs = w.exercises.filter((e) => e.exerciseId === exerciseId)
    if (!logs.length) continue
    let top: SetLog | null = null
    let e1rm: number | null = null
    let volume = 0
    let sets = 0
    for (const log of logs) {
      const t = topSet(log)
      if (t && (!top || (t.weightKg ?? 0) > (top.weightKg ?? 0))) top = t
      const e = bestE1RM(log)
      if (e != null && (e1rm == null || e > e1rm)) e1rm = e
      volume += exerciseVolume(log)
      sets += completedSets(log.sets).length
    }
    if (!top) continue
    points.push({
      date: workoutDate(w),
      workoutId: w.id,
      topWeight: top.weightKg ?? 0,
      topReps: top.reps ?? 0,
      e1rm,
      volume,
      sets,
    })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export interface PersonalRecord {
  exerciseId: ID
  /** Heaviest weight actually lifted. */
  maxWeight: number
  maxWeightReps: number
  maxWeightDate: string
  /** Estimated, labeled as such in UI. */
  bestE1RM: number | null
  bestVolumeSession: number
}

export function personalRecords(workouts: WorkoutSession[]): PersonalRecord[] {
  const ids = new Set<ID>()
  workouts.forEach((w) => w.status === 'completed' && w.exercises.forEach((e) => ids.add(e.exerciseId)))
  const prs: PersonalRecord[] = []
  for (const id of ids) {
    const series = exerciseSeries(workouts, id)
    if (!series.length) continue
    const top = series.reduce((b, p) => (p.topWeight > b.topWeight ? p : b))
    const e = series.reduce<number | null>((b, p) => (p.e1rm != null && (b == null || p.e1rm > b) ? p.e1rm : b), null)
    prs.push({
      exerciseId: id,
      maxWeight: top.topWeight,
      maxWeightReps: top.topReps,
      maxWeightDate: top.date,
      bestE1RM: e,
      bestVolumeSession: Math.max(...series.map((p) => p.volume)),
    })
  }
  return prs.sort((a, b) => b.maxWeight - a.maxWeight)
}

export interface WeekBucket {
  weekStart: string
  label: string
  coached: number
  independent: number
  volume: number
}

/** Weekly buckets covering the last `weeks` weeks, including empty weeks. */
export function weeklyBuckets(workouts: WorkoutSession[], weeks: number, now = new Date()): WeekBucket[] {
  const current = startOfWeek(now)
  const buckets: WeekBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(current)
    ws.setDate(ws.getDate() - i * 7)
    buckets.push({
      weekStart: ws.toISOString(),
      label: `${ws.getMonth() + 1}/${ws.getDate()}`,
      coached: 0,
      independent: 0,
      volume: 0,
    })
  }
  const index = new Map(buckets.map((b, i) => [startOfWeek(b.weekStart).getTime(), i]))
  for (const w of workouts) {
    if (w.status !== 'completed') continue
    const i = index.get(startOfWeek(workoutDate(w)).getTime())
    if (i == null) continue
    buckets[i][w.type] += 1
    buckets[i].volume += workoutVolume(w)
  }
  return buckets
}

/** Share of the last N weeks with at least `target` workouts. */
export function consistency(buckets: WeekBucket[], target: number) {
  if (!buckets.length) return 0
  const hit = buckets.filter((b) => b.coached + b.independent >= target).length
  return hit / buckets.length
}

/** Most recent completed log for an exercise before a given time. */
export function lastExerciseLog(
  workouts: WorkoutSession[],
  studentId: ID,
  exerciseId: ID,
  excludeWorkoutId?: ID,
): { log: ExerciseLog; workout: WorkoutSession } | null {
  const list = completedWorkouts(workouts, studentId)
  for (const w of list) {
    if (w.id === excludeWorkoutId) continue
    const log = w.exercises.find((e) => e.exerciseId === exerciseId && completedSets(e.sets).length)
    if (log) return { log, workout: w }
  }
  return null
}

/** Workouts since `sinceISO` where the actual top weight beat every earlier session. */
export function recentPRs(workouts: WorkoutSession[], sinceISO: string) {
  const ids = new Set<ID>()
  workouts.forEach((w) => w.status === 'completed' && w.exercises.forEach((e) => ids.add(e.exerciseId)))
  const hits: { exerciseId: ID; weight: number; reps: number; previous: number; date: string }[] = []
  for (const id of ids) {
    let best = -Infinity
    let latestHit: (typeof hits)[number] | null = null
    for (const p of exerciseSeries(workouts, id)) {
      if (p.topWeight > best) {
        if (best > 0 && p.date >= sinceISO) latestHit = { exerciseId: id, weight: p.topWeight, reps: p.topReps, previous: best, date: p.date }
        best = p.topWeight
      }
    }
    if (latestHit) hits.push(latestHit)
  }
  return hits.sort((a, b) => b.date.localeCompare(a.date))
}

/** Consecutive weeks (ending this or last week) with at least one workout. */
export function weekStreak(workouts: WorkoutSession[], now = new Date()) {
  const buckets = weeklyBuckets(workouts, 52, now)
  let i = buckets.length - 1
  if (buckets[i].coached + buckets[i].independent === 0) i-- // current week may still be in progress
  let streak = 0
  for (; i >= 0 && buckets[i].coached + buckets[i].independent > 0; i--) streak++
  return streak
}

export function summarizeSets(log: ExerciseLog, max = 4) {
  const sets = completedSets(log.sets)
  const parts = sets.slice(0, max).map((s) => `${s.weightKg}×${s.reps}`)
  if (sets.length > max) parts.push(`+${sets.length - max}`)
  return parts.join('、')
}
