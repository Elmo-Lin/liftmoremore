// Fictional demo data. All people, numbers and notes are invented.
// The generator is deterministic (seeded RNG) but dates are relative to the
// moment of seeding, so the demo always shows "recent" activity.
import type {
  AppData,
  Appointment,
  Coach,
  CoachStudentRelationship,
  ExerciseLog,
  ProgressMetric,
  SessionPackage,
  SessionTransaction,
  SetLog,
  Student,
  TrainingDay,
  TrainingGoal,
  TrainingPlan,
  WorkoutSession,
} from '../types'
import { EXERCISES, REFERENCE_WEIGHT } from './exercises'

export const SCHEMA_VERSION = 1
export const COACH_ID = 'coach_lin'
export const DEFAULT_DEMO_STUDENT_ID = 'stu_01'

const HISTORY_WEEKS = 14
const DAY = 86400000

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Training plans (coach-authored)
// ---------------------------------------------------------------------------

type Rx = [exerciseId: string, sets: number, reps: string, notes?: string]

function day(id: string, name: string, focus: string, rx: Rx[]): TrainingDay {
  return {
    id,
    name,
    focus,
    exercises: rx.map(([exerciseId, sets, reps, notes], i) => ({
      id: `${id}_rx${i + 1}`,
      exerciseId,
      sets,
      reps,
      restSec: sets >= 5 ? 180 : 90,
      notes,
    })),
  }
}

function plan(
  id: string,
  name: string,
  description: string,
  goal: TrainingGoal,
  weeks: number,
  days: TrainingDay[],
  createdDaysAgo: number,
  now: number,
): TrainingPlan {
  const created = new Date(now - createdDaysAgo * DAY).toISOString()
  return { id, coachId: COACH_ID, authorRole: 'coach', name, description, goal, weeks, days, createdAt: created, updatedAt: created }
}

function buildPlans(now: number): TrainingPlan[] {
  return [
    plan('plan_strength8', '力量週8週訓練', '以深蹲、臥推、硬舉、肩推為核心，每週 3 練、8 週線性加重：完成目標組數就小幅增加重量。', 'strength', 8, [
      day('ps8_a', '力量 A', '深蹲 / 臥推', [
        ['ex_squat', 5, '5', '目標 RPE 8，完成即下次加 2.5 kg'],
        ['ex_bench', 5, '5'],
        ['ex_cablerow', 3, '8'],
      ]),
      day('ps8_b', '力量 B', '硬舉 / 肩推', [
        ['ex_deadlift', 3, '3', '技術優先，每週加 2.5–5 kg'],
        ['ex_ohp', 5, '5'],
        ['ex_latpd', 3, '8'],
      ]),
      day('ps8_c', '力量 C', '深蹲 / 臥推（次重）', [
        ['ex_squat', 4, '4', '約 A 日重量的 90%'],
        ['ex_bench', 4, '4'],
        ['ex_rdl', 3, '6'],
      ]),
    ], 200, now),
    plan('plan_hyper8', '小肌肥大8週訓練', '上下肢分化每週 4 練，8–15 下累積訓練量，額外加強肩、手臂等小肌群。', 'hypertrophy', 8, [
      day('ph8_ua', '上肢 A', '胸 / 背 / 側肩', [
        ['ex_bench', 4, '6-8'],
        ['ex_cablerow', 4, '8-10'],
        ['ex_lateral', 4, '12-15', '慢放 2 秒'],
        ['ex_curl', 3, '10-12'],
        ['ex_pushdown', 3, '12'],
      ]),
      day('ph8_la', '下肢 A', '蹲為主', [
        ['ex_squat', 4, '6-8', '最後一組保留 1–2 下'],
        ['ex_rdl', 3, '8'],
        ['ex_legpress', 3, '10'],
        ['ex_legcurl', 3, '12'],
      ]),
      day('ph8_ub', '上肢 B', '肩 / 上斜 / 手臂', [
        ['ex_incline', 4, '8-10'],
        ['ex_dbrow', 3, '10'],
        ['ex_lateral', 4, '15'],
        ['ex_facepull', 3, '15'],
        ['ex_curl', 3, '12'],
        ['ex_pushdown', 3, '12'],
      ]),
      day('ph8_lb', '下肢 B', '髖主導', [
        ['ex_deadlift', 3, '5'],
        ['ex_bss', 3, '8', '每腳 8 下'],
        ['ex_hipthrust', 3, '10', '頂端停 1 秒'],
        ['ex_legcurl', 3, '12'],
      ]),
    ], 150, now),
    plan('plan_circuit16', '循環16週訓練', '全身循環每週 3 練：動作間休息 30 秒、一輪後休息 2 分鐘，16 週逐步增加輪數與重量。', 'fatLoss', 16, [
      day('pc16_a', '循環 A', '全身', [
        ['ex_goblet', 3, '12', '下蹲時膝蓋與腳尖同方向'],
        ['ex_dbpress', 3, '12'],
        ['ex_seatedrow', 3, '12'],
        ['ex_hipthrust', 3, '12'],
        ['ex_lateral', 2, '15'],
      ]),
      day('pc16_b', '循環 B', '全身', [
        ['ex_legpress', 3, '15'],
        ['ex_latpd', 3, '12'],
        ['ex_rdl', 3, '10', '保持背部中立，感受腿後側伸展'],
        ['ex_dbrow', 3, '12'],
        ['ex_facepull', 2, '15'],
      ]),
      day('pc16_c', '循環 C', '全身', [
        ['ex_bss', 3, '10', '每腳 10 下'],
        ['ex_incline', 3, '12'],
        ['ex_cablerow', 3, '12'],
        ['ex_legcurl', 3, '12'],
        ['ex_pushdown', 2, '15'],
      ]),
    ], 120, now),
  ]
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

interface Profile {
  student: Omit<Student, 'role' | 'createdAt' | 'joinedAt'>
  joinedWeeksAgo: number
  stoppedWeeksAgo?: number
  /** Weekdays (0=Sun) for coached / independent sessions. */
  coachedDays: number[]
  independentDays: number[]
  hour: number
  strength: number
  weeklyRate: number
  packageSize: 10 | 20
  pricePerSession: number
  targetRemaining: number
  bodyweight: number
  bodyweightTrend: number
  /** Leave the most recent coached session un-deducted, to demo the separate action. */
  pendingLast?: boolean
  adjustments?: { weeksAgo: number; delta: number; reason: string }[]
}

const PROFILES: Profile[] = [
  {
    student: {
      id: 'stu_01', name: 'Emily Chen', email: 'emily.chen@example.com', phone: '0912-345-678', gender: 'female',
      birthYear: 1994, heightCm: 162, goal: 'hypertrophy', goalDetail: '增加上半身線條，半年內臥推做到 40 kg',
      status: 'active', weeklyFrequency: 3, activePlanId: 'plan_hyper8',
      coachNotes: '動作學習快，臥推離心控制已明顯進步。工作日晚上時間較穩定，週末偶爾出差。',
    },
    joinedWeeksAgo: 30, coachedDays: [2, 4], independentDays: [6], hour: 19, strength: 0.55, weeklyRate: 0.018,
    packageSize: 20, pricePerSession: 1700, targetRemaining: 7, bodyweight: 54, bodyweightTrend: 0.08, pendingLast: true,
    adjustments: [{ weeksAgo: 6, delta: 1, reason: '教練臨時調課，補償 1 堂' }],
  },
  {
    student: {
      id: 'stu_02', name: 'Kevin Wang', email: 'kevin.wang@example.com', phone: '0928-112-334', gender: 'male',
      birthYear: 1988, heightCm: 175, goal: 'strength', goalDetail: '深蹲突破 140 kg，提升整體肌力',
      status: 'active', weeklyFrequency: 3, activePlanId: 'plan_strength8',
      coachNotes: '工程師，久坐。深蹲底部髖關節活動度需持續熱身。偏好早上 7 點上課。',
    },
    joinedWeeksAgo: 40, coachedDays: [1, 3], independentDays: [5], hour: 7, strength: 1.15, weeklyRate: 0.012,
    packageSize: 20, pricePerSession: 1700, targetRemaining: 2, bodyweight: 78, bodyweightTrend: 0.03,
  },
  {
    student: {
      id: 'stu_03', name: 'Grace Lee', email: 'grace.lee@example.com', phone: '0935-776-210', gender: 'female',
      birthYear: 1997, heightCm: 158, goal: 'fatLoss', goalDetail: '三個月內體重下降 4 kg，維持每週 3 次訓練',
      status: 'active', weeklyFrequency: 3, activePlanId: 'plan_circuit16',
      coachNotes: '有在記錄飲食。動作穩定度佳，可逐步縮短組間休息。',
    },
    joinedWeeksAgo: 16, coachedDays: [1, 4], independentDays: [0], hour: 12, strength: 0.5, weeklyRate: 0.015,
    packageSize: 20, pricePerSession: 1600, targetRemaining: 12, bodyweight: 61, bodyweightTrend: -0.3,
  },
  {
    student: {
      id: 'stu_04', name: 'Eric Chang', email: 'eric.chang@example.com', phone: '0910-558-902', gender: 'male',
      birthYear: 1992, heightCm: 178, goal: 'powerlifting', goalDetail: '明年春季健力賽，三項總和目標 500 kg',
      status: 'active', weeklyFrequency: 4, activePlanId: 'plan_strength8',
      coachNotes: '比賽經驗 1 次。硬舉起槓時背部角度需注意，臥推暫停節奏要再練。',
    },
    joinedWeeksAgo: 52, coachedDays: [2, 5], independentDays: [0, 3], hour: 20, strength: 1.5, weeklyRate: 0.009,
    packageSize: 10, pricePerSession: 1800, targetRemaining: 2, bodyweight: 83, bodyweightTrend: 0.02, pendingLast: true,
  },
  {
    student: {
      id: 'stu_05', name: 'Tiffany Liu', email: 'tiffany.liu@example.com', phone: '0921-300-457', gender: 'female',
      birthYear: 1985, heightCm: 165, goal: 'general', goalDetail: '建立運動習慣，日常搬重物更輕鬆',
      status: 'active', weeklyFrequency: 2, activePlanId: 'plan_circuit16',
      coachNotes: '兩個孩子的媽媽，時間以平日上午為主。喜歡有明確進度的訓練計畫。',
    },
    joinedWeeksAgo: 20, coachedDays: [3], independentDays: [6], hour: 10, strength: 0.45, weeklyRate: 0.02,
    packageSize: 10, pricePerSession: 1800, targetRemaining: 5, bodyweight: 63, bodyweightTrend: -0.1,
  },
  {
    student: {
      id: 'stu_06', name: 'Ryan Huang', email: 'ryan.huang@example.com', phone: '0987-221-064', gender: 'male',
      birthYear: 1999, heightCm: 172, goal: 'hypertrophy', goalDetail: '增重 5 kg，以肌肉量為主',
      status: 'active', weeklyFrequency: 4, activePlanId: 'plan_hyper8',
      coachNotes: '大學研究生，自主訓練頻率高，記錄習慣好。飲食蛋白質攝取需再提醒。',
    },
    joinedWeeksAgo: 24, coachedDays: [1, 4], independentDays: [3, 6], hour: 18, strength: 0.95, weeklyRate: 0.014,
    packageSize: 20, pricePerSession: 1600, targetRemaining: 15, bodyweight: 66, bodyweightTrend: 0.18,
    adjustments: [{ weeksAgo: 4, delta: -1, reason: '未提前取消且未到課，依約定扣除 1 堂' }],
  },
  {
    student: {
      id: 'stu_07', name: 'Cindy Wu', email: 'cindy.wu@example.com', phone: '0916-884-120', gender: 'female',
      birthYear: 1990, heightCm: 160, goal: 'mobility', goalDetail: '改善圓肩姿勢，提升核心穩定',
      status: 'active', weeklyFrequency: 1, activePlanId: 'plan_circuit16',
      coachNotes: '辦公室工作，每次課前做 10 分鐘胸椎活動。目前以每週一堂為主。',
    },
    joinedWeeksAgo: 14, coachedDays: [5], independentDays: [], hour: 12, strength: 0.42, weeklyRate: 0.015,
    packageSize: 10, pricePerSession: 1800, targetRemaining: 3, bodyweight: 52, bodyweightTrend: 0,
  },
  {
    student: {
      id: 'stu_08', name: 'Jerry Tsai', email: 'jerry.tsai@example.com', phone: '0933-650-781', gender: 'male',
      birthYear: 1979, heightCm: 170, goal: 'general', goalDetail: '維持肌力，配合週末登山',
      status: 'active', weeklyFrequency: 2, activePlanId: 'plan_circuit16',
      coachNotes: '週末常登山，週一安排較輕的課程。',
    },
    joinedWeeksAgo: 35, coachedDays: [2], independentDays: [4], hour: 7, strength: 0.8, weeklyRate: 0.008,
    packageSize: 10, pricePerSession: 1800, targetRemaining: 8, bodyweight: 72, bodyweightTrend: -0.05,
  },
  {
    student: {
      id: 'stu_09', name: 'Leo Cheng', email: 'leo.cheng@example.com', phone: '0955-410-236', gender: 'male',
      birthYear: 1995, heightCm: 180, goal: 'strength', goalDetail: '提升三大項肌力',
      status: 'inactive', weeklyFrequency: 2, activePlanId: 'plan_strength8',
      coachNotes: '方案用完後暫停，表示工作穩定後會回來。',
    },
    joinedWeeksAgo: 28, stoppedWeeksAgo: 5, coachedDays: [2, 5], independentDays: [], hour: 20, strength: 1.0, weeklyRate: 0.012,
    packageSize: 10, pricePerSession: 1800, targetRemaining: 0, bodyweight: 80, bodyweightTrend: 0,
  },
  {
    student: {
      id: 'stu_10', name: 'Vivian Hsu', email: 'vivian.hsu@example.com', phone: '0975-302-118', gender: 'female',
      birthYear: 2001, heightCm: 166, goal: 'hypertrophy', goalDetail: '臀腿線條',
      status: 'inactive', weeklyFrequency: 2, activePlanId: 'plan_hyper8',
      coachNotes: '出國交換一學期，明年 2 月回台後繼續，剩餘堂數保留。',
    },
    joinedWeeksAgo: 22, stoppedWeeksAgo: 3, coachedDays: [1, 4], independentDays: [], hour: 17, strength: 0.55, weeklyRate: 0.016,
    packageSize: 10, pricePerSession: 1800, targetRemaining: 6, bodyweight: 56, bodyweightTrend: 0.02,
  },
  {
    student: {
      id: 'stu_11', name: 'Allen Lin', email: 'allen.lin@example.com', phone: '0918-907-643', gender: 'male',
      birthYear: 1993, heightCm: 173, goal: 'fatLoss', goalDetail: '體重下降並提升體能，能連續爬樓梯不喘',
      status: 'active', weeklyFrequency: 2, activePlanId: 'plan_circuit16',
      coachNotes: '新學員，先以動作學習為主，重量保守。',
    },
    joinedWeeksAgo: 3, coachedDays: [2, 5], independentDays: [], hour: 18, strength: 0.65, weeklyRate: 0.03,
    packageSize: 20, pricePerSession: 1600, targetRemaining: 16, bodyweight: 88, bodyweightTrend: -0.4,
  },
  {
    student: {
      id: 'stu_12', name: 'Elmo Lin', email: 'elmo.lin@example.com', phone: '0930-118-526', gender: 'male',
      birthYear: 1996, heightCm: 178, goal: 'powerlifting', goalDetail: '三大項穩定進步，硬舉突破 180 kg',
      status: 'active', weeklyFrequency: 4, activePlanId: 'plan_strength8',
      coachNotes: '自主訓練很規律，會自己記錄。硬舉起始姿勢偶爾圓背，熱身時加強髖鉸鏈練習。',
    },
    joinedWeeksAgo: 26, coachedDays: [1, 4], independentDays: [3, 6], hour: 20, strength: 1.0, weeklyRate: 0.015,
    packageSize: 20, pricePerSession: 1700, targetRemaining: 9, bodyweight: 75, bodyweightTrend: 0.05,
  },
]

const COACHED_NOTES = [
  '動作穩定，下次主項加 2.5 kg。',
  '最後一組 RPE 約 9，下週維持重量。',
  '熱身時間拉長，髖關節活動度明顯改善。',
  '睡眠不足，今天降低總量。',
  '離心控制很好，繼續保持節奏。',
  '握力是限制因素，下次加入握力訓練。',
  '',
  '',
]
const INDEPENDENT_NOTES = ['自己練，狀態不錯。', '時間較趕，跳過最後一個動作。', '', '', '']

function parseReps(reps: string, rand: () => number) {
  const [lo, hi] = reps.split('-').map((n) => parseInt(n, 10))
  if (!hi) return lo
  return lo + Math.floor(rand() * (hi - lo + 1))
}

const roundTo = (n: number, inc: number) => Math.max(inc, Math.round(n / inc) * inc)

export function generateMockData(nowDate = new Date()): AppData {
  const rand = mulberry32(20261020)
  let seq = 0
  const id = (prefix: string) => `${prefix}_${(++seq).toString(36).padStart(4, '0')}`
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

  const now = nowDate.getTime()
  const today = new Date(nowDate)
  today.setHours(0, 0, 0, 0)
  // Window starts on the Monday HISTORY_WEEKS weeks ago.
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - ((windowStart.getDay() + 6) % 7) - (HISTORY_WEEKS - 1) * 7)

  const coach: Coach = {
    id: COACH_ID,
    role: 'coach',
    name: 'Stone',
    email: 'stone@example.com',
    phone: '0900-000-123',
    title: '肌力與體能教練',
    studio: 'Action Gym（台北大安）',
    createdAt: new Date(now - 400 * DAY).toISOString(),
  }

  const plans = buildPlans(now)
  const planById = new Map(plans.map((p) => [p.id, p]))
  const exerciseById = new Map(EXERCISES.map((e) => [e.id, e]))

  const students: Student[] = []
  const relationships: CoachStudentRelationship[] = []
  const workouts: WorkoutSession[] = []
  const packages: SessionPackage[] = []
  const transactions: SessionTransaction[] = []
  const metrics: ProgressMetric[] = []
  const appointments: Appointment[] = []

  for (const p of PROFILES) {
    const joinedAt = new Date(today.getTime() - p.joinedWeeksAgo * 7 * DAY)
    const student: Student = {
      ...p.student,
      role: 'student',
      joinedAt: joinedAt.toISOString(),
      createdAt: joinedAt.toISOString(),
    }
    students.push(student)
    relationships.push({
      id: `rel_${student.id}`,
      coachId: COACH_ID,
      studentId: student.id,
      status: student.status,
      startedAt: student.joinedAt,
    })

    const startMs = Math.max(windowStart.getTime(), joinedAt.getTime())
    const endMs = p.stoppedWeeksAgo ? today.getTime() - p.stoppedWeeksAgo * 7 * DAY : today.getTime() - 1
    const planDays = planById.get(student.activePlanId ?? 'plan_circuit16')!.days
    let dayIdx = 0
    const studentWorkouts: WorkoutSession[] = []

    for (let t = startMs; t <= endMs; t += DAY) {
      const date = new Date(t)
      const weekday = date.getDay()
      const isCoached = p.coachedDays.includes(weekday)
      const isIndependent = p.independentDays.includes(weekday)
      if (!isCoached && !isIndependent) continue
      if (rand() < (isCoached ? 0.07 : 0.25)) continue

      const weekIndex = Math.floor((t - startMs) / (7 * DAY))
      const deload = weekIndex > 0 && weekIndex % 6 === 5 ? 0.9 : 1
      const trainingDay = planDays[dayIdx % planDays.length]
      dayIdx++

      const type = isCoached ? 'coached' : 'independent'
      const exercises: ExerciseLog[] = []
      const rxList = type === 'independent' && rand() < 0.3 ? trainingDay.exercises.slice(0, -1) : trainingDay.exercises
      for (const rx of rxList) {
        const ex = exerciseById.get(rx.exerciseId)!
        const base = REFERENCE_WEIGHT[rx.exerciseId] * p.strength
        const progress = 1 + p.weeklyRate * weekIndex
        const noise = 1 + (rand() - 0.5) * 0.03
        const weight = roundTo(base * progress * deload * noise * (type === 'independent' ? 0.97 : 1), ex.increment)
        const sets: SetLog[] = []
        for (let s = 0; s < rx.sets; s++) {
          let reps = parseReps(rx.reps, rand)
          if (s === rx.sets - 1 && rand() < 0.25) reps = Math.max(1, reps - 1)
          const logRpe = rand() < (type === 'coached' ? 0.7 : 0.3)
          sets.push({
            id: id('set'),
            weightKg: weight,
            reps,
            rpe: logRpe ? Math.min(10, 6.5 + Math.round(rand() * 5) / 2 + (s === rx.sets - 1 ? 0.5 : 0)) : null,
            completed: true,
          })
        }
        exercises.push({ id: id('el'), exerciseId: rx.exerciseId, sets })
      }

      const hour = type === 'coached' ? p.hour : pick([7, 12, 18, 20])
      const startedAt = new Date(t)
      startedAt.setHours(hour, pick([0, 0, 15, 30]), 0, 0)
      const completedAt = new Date(startedAt.getTime() + (50 + Math.floor(rand() * 25)) * 60000)
      const workout: WorkoutSession = {
        id: id('wo'),
        studentId: student.id,
        coachId: type === 'coached' ? COACH_ID : undefined,
        type,
        createdBy: type === 'coached' ? 'coach' : 'student',
        status: 'completed',
        title: trainingDay.name,
        planId: student.activePlanId,
        trainingDayId: trainingDay.id,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        updatedAt: completedAt.toISOString(),
        exercises,
        notes: pick(type === 'coached' ? COACHED_NOTES : INDEPENDENT_NOTES),
      }
      studentWorkouts.push(workout)
    }
    workouts.push(...studentWorkouts)

    // --- Session packages & transactions, derived from coached workouts ---
    const coached = studentWorkouts.filter((w) => w.type === 'coached')
    const billable = p.pendingLast ? coached.slice(0, -1) : coached
    const adjustments = (p.adjustments ?? []).map((a) => ({
      ...a,
      at: new Date(today.getTime() - a.weeksAgo * 7 * DAY + 10 * 3600000).toISOString(),
    }))
    const adjSum = adjustments.reduce((s, a) => s + a.delta, 0)
    const needed = billable.length - adjSum + p.targetRemaining
    const preWindow = joinedAt.getTime() < windowStart.getTime()
    const capacities: number[] = []
    if (preWindow && needed > 0) {
      const regular = Math.floor((needed - 1) / p.packageSize)
      capacities.push(needed - regular * p.packageSize, ...Array(regular).fill(p.packageSize))
    } else {
      // New students: buy just enough packages to cover sessions so far.
      const count = Math.max(1, Math.ceil((billable.length - adjSum) / p.packageSize))
      for (let i = 0; i < count; i++) capacities.push(p.packageSize)
    }

    const pkgs: SessionPackage[] = capacities.map((cap, i) => {
      const carryOver = preWindow && i === 0
      return {
        id: id('pkg'),
        studentId: student.id,
        coachId: COACH_ID,
        name: carryOver ? '期初轉入堂數' : `${cap} 堂一對一課程`,
        totalSessions: cap,
        priceTwd: carryOver ? 0 : cap * p.pricePerSession,
        purchaseDate: '',
        notes: carryOver ? '導入系統前的剩餘堂數，原始方案款項已於先前收取。' : undefined,
      }
    })
    const remaining = pkgs.map((pk) => pk.totalSessions)

    type Ev = { at: string; delta: number; reason: string; type: 'deduction' | 'adjustment'; workoutId?: string }
    const events: Ev[] = [
      ...billable.map((w) => ({
        at: w.completedAt!,
        delta: -1,
        reason: `${w.title} 上課扣堂`,
        type: 'deduction' as const,
        workoutId: w.id,
      })),
      ...adjustments.map((a) => ({ at: a.at, delta: a.delta, reason: a.reason, type: 'adjustment' as const })),
    ].sort((a, b) => a.at.localeCompare(b.at))

    for (const ev of events) {
      let i = remaining.findIndex((r) => r > 0)
      if (ev.delta > 0) i = i === -1 ? pkgs.length - 1 : i
      if (i === -1) continue
      if (!pkgs[i].purchaseDate) pkgs[i].purchaseDate = new Date(new Date(ev.at).getTime() - 2 * DAY).toISOString()
      remaining[i] += ev.delta
      transactions.push({
        id: id('tx'),
        packageId: pkgs[i].id,
        studentId: student.id,
        type: ev.type,
        delta: ev.delta,
        reason: ev.reason,
        workoutSessionId: ev.workoutId,
        createdAt: new Date(new Date(ev.at).getTime() + 5 * 60000).toISOString(),
        createdBy: 'coach',
      })
    }
    for (const pk of pkgs) {
      if (!pk.purchaseDate) pk.purchaseDate = new Date(Math.min(now - 3 * DAY, endMs)).toISOString()
    }
    pkgs[0].purchaseDate = new Date(Math.min(new Date(pkgs[0].purchaseDate).getTime(), startMs - DAY)).toISOString()
    packages.push(...pkgs)

    // --- Bodyweight metrics (weekly) ---
    let bw = p.bodyweight
    for (let t = startMs, w = 0; t <= Math.min(endMs, now); t += 7 * DAY, w++) {
      bw += p.bodyweightTrend + (rand() - 0.5) * 0.4
      metrics.push({
        id: id('met'),
        studentId: student.id,
        type: 'bodyweight',
        value: Math.round(bw * 10) / 10,
        unit: 'kg',
        recordedAt: new Date(t + 8 * 3600000).toISOString(),
      })
    }

    // --- Upcoming appointments (next 14 days, excluding today) ---
    if (student.status === 'active') {
      for (let d = 1; d <= 14; d++) {
        const date = new Date(today.getTime() + d * DAY)
        if (!p.coachedDays.includes(date.getDay())) continue
        date.setHours(p.hour, 0, 0, 0)
        appointments.push({
          id: id('apt'),
          coachId: COACH_ID,
          studentId: student.id,
          startAt: date.toISOString(),
          durationMin: 60,
          location: 'Action Gym',
          status: 'scheduled',
        })
      }
    }
  }

  // Today's schedule (fixed so the dashboard always has content).
  const todaySlots: [string, number, number][] = [
    ['stu_02', 7, 0],
    ['stu_01', 12, 30],
    ['stu_04', 19, 0],
    ['stu_06', 20, 30],
  ]
  for (const [studentId, h, m] of todaySlots) {
    const at = new Date(today)
    at.setHours(h, m, 0, 0)
    appointments.push({
      id: id('apt'),
      coachId: COACH_ID,
      studentId,
      startAt: at.toISOString(),
      durationMin: 60,
      location: 'Action Gym',
      status: 'scheduled',
    })
  }
  appointments.sort((a, b) => a.startAt.localeCompare(b.startAt))

  // One unfinished draft to demonstrate interrupted-session recovery.
  const draftDay = planById.get('plan_circuit16')!.days[0]
  const draftStart = new Date(now - 95 * 60000).toISOString()
  workouts.push({
    id: id('wo'),
    studentId: 'stu_03',
    coachId: COACH_ID,
    type: 'coached',
    createdBy: 'coach',
    status: 'draft',
    title: draftDay.name,
    planId: 'plan_circuit16',
    trainingDayId: draftDay.id,
    startedAt: draftStart,
    updatedAt: draftStart,
    notes: '',
    exercises: draftDay.exercises.slice(0, 3).map((rx, i) => {
      const w = roundTo(REFERENCE_WEIGHT[rx.exerciseId] * 0.5 * 1.15, exerciseById.get(rx.exerciseId)!.increment)
      return {
        id: id('el'),
        exerciseId: rx.exerciseId,
        sets: Array.from({ length: rx.sets }, (_, s) => ({
          id: id('set'),
          weightKg: w,
          reps: parseInt(rx.reps, 10),
          rpe: null,
          completed: i === 0 || (i === 1 && s === 0),
        })),
      }
    }),
  })

  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: nowDate.toISOString(),
    coach,
    students,
    relationships,
    exercises: EXERCISES,
    plans,
    workouts,
    packages,
    transactions,
    metrics,
    appointments,
  }
}
