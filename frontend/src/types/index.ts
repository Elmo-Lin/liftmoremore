// Domain model for Lift More More.
// Rules encoded here:
// - Coach and Student are distinct user roles. A self-tracker ('self') has no coach:
//   the backend gives them a one-person space where they are the only student.
// - Workout sessions always belong to exactly one student.
// - Training plans are authored by coaches, or by a self-tracker for themselves; workout logs record who created them.
// - Session balances are NEVER stored; they are derived from a package's
//   totalSessions plus the sum of its transaction deltas.

export type ID = string
/** ISO 8601 timestamp, e.g. 2026-10-20T09:30:00.000Z */
export type ISODate = string

/** 'owner' runs a studio and also teaches, so everywhere a coach can go an owner can too. */
export type Role = 'coach' | 'owner' | 'student' | 'self'

export interface User {
  id: ID
  role: Role
  name: string
  email: string
  phone?: string
  createdAt: ISODate
}

export interface Coach extends User {
  role: 'coach'
  title: string
  studio: string
  /** Own profile only: quick-select options when adding a package. Undefined until customized (defaults apply). */
  packagePresets?: PackagePreset[]
}

/** A coach's quick-select option for new session packages. */
export interface PackagePreset {
  name: string
  totalSessions: number
  priceTwd: number
}

export type StudentStatus = 'active' | 'inactive'

export type TrainingGoal =
  | 'strength'
  | 'hypertrophy'
  | 'fatLoss'
  | 'general'
  | 'powerlifting'
  | 'mobility'

export type Gender = 'female' | 'male' | 'other'

export interface Student extends User {
  role: 'student'
  gender: Gender
  birthYear?: number
  heightCm?: number
  goal: TrainingGoal
  goalDetail: string
  status: StudentStatus
  /** Planned sessions per week (coached + independent). */
  weeklyFrequency: number
  /** Private coach notes, never shown to the student. */
  coachNotes: string
  /** The coach-authored plan currently assigned to this student. */
  activePlanId?: ID
  joinedAt: ISODate
  /** API mode, coach view: whether the student has activated a login. */
  activated?: boolean
}

export interface CoachStudentRelationship {
  id: ID
  coachId: ID
  studentId: ID
  status: StudentStatus
  startedAt: ISODate
}

export type MuscleGroup = 'legs' | 'back' | 'chest' | 'shoulders' | 'arms' | 'glutes' | 'core'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'other'

export interface Exercise {
  id: ID
  name: string
  nameEn: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  /** Smallest practical weight jump in kg. */
  increment: number
  /** Added by this workspace (coaches share theirs with the studio and students). */
  custom?: boolean
  /** A custom exercise taken off the picker; workouts that used it still show it. */
  archived?: boolean
}

export interface ExercisePrescription {
  id: ID
  exerciseId: ID
  sets: number
  /** Free-form target reps, e.g. "5" or "8-10". */
  reps: string
  targetWeightKg?: number
  restSec?: number
  notes?: string
}

export interface TrainingDay {
  id: ID
  name: string
  focus?: string
  exercises: ExercisePrescription[]
}

export interface TrainingPlan {
  id: ID
  coachId: ID
  /** Plans are always coach-authored; students can only read them. */
  authorRole: 'coach'
  name: string
  description: string
  goal: TrainingGoal
  weeks?: number
  days: TrainingDay[]
  createdAt: ISODate
  updatedAt: ISODate
}

export interface SetLog {
  id: ID
  weightKg: number | null
  reps: number | null
  rpe: number | null
  completed: boolean
}

export interface ExerciseLog {
  id: ID
  exerciseId: ID
  sets: SetLog[]
  notes?: string
}

/** coached: led by the coach (may be billed). independent: student's own workout (never billed). */
export type WorkoutType = 'coached' | 'independent'
export type WorkoutStatus = 'draft' | 'completed'

export interface WorkoutSession {
  id: ID
  studentId: ID
  coachId?: ID
  type: WorkoutType
  createdBy: Role
  status: WorkoutStatus
  title: string
  planId?: ID
  trainingDayId?: ID
  startedAt: ISODate
  completedAt?: ISODate
  updatedAt: ISODate
  exercises: ExerciseLog[]
  notes: string
}

export interface SessionPackage {
  id: ID
  studentId: ID
  coachId: ID
  name: string
  totalSessions: number
  priceTwd: number
  purchaseDate: ISODate
  expiresAt?: ISODate
  notes?: string
}

/**
 * Every change to a package balance is a transaction.
 * deduction: delta = -1 linked to a coached workout.
 * reversal: delta = +1 undoing a deduction (keeps history intact).
 * adjustment: manual +/- n with a required reason.
 */
export type TransactionType = 'deduction' | 'reversal' | 'adjustment'

export interface SessionTransaction {
  id: ID
  packageId: ID
  studentId: ID
  type: TransactionType
  delta: number
  reason: string
  workoutSessionId?: ID
  createdAt: ISODate
  createdBy: Role
}

export type MetricType = 'bodyweight'

export interface ProgressMetric {
  id: ID
  studentId: ID
  type: MetricType
  value: number
  unit: 'kg'
  recordedAt: ISODate
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

/** Mock calendar entry for upcoming coaching sessions. */
export interface Appointment {
  id: ID
  coachId: ID
  studentId: ID
  startAt: ISODate
  durationMin: number
  location: string
  status: AppointmentStatus
}

export type CoachMemberStatus = 'active' | 'invited' | 'inactive'

/** A coach in a workspace (studio owner included). */
export interface CoachMember {
  id: ID
  role: 'owner' | 'coach'
  name: string
  email: string
  title?: string
  status: CoachMemberStatus
  /** Owner only, while the coach has not activated their account. */
  inviteCode?: string
  /** Offline demo only: a studio coach's own quick-select options (see Coach.packagePresets). */
  packagePresets?: PackagePreset[]
  createdAt: ISODate
}

/** The workspace: a free coach ('solo'), a studio with several coaches, or a self-tracker. */
export interface Studio {
  id: ID
  kind: 'solo' | 'studio' | 'self'
  name?: string
  ownerId: ID
  /** Seats for coaches, the owner included (from the plan in API mode). */
  maxCoaches?: number
  coaches: CoachMember[]
}

export type PlanId = 'pro' | 'team' | 'self'
/** expired: the trial or paid period lapsed; the workspace is read-only until someone subscribes. */
export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'

/** API mode, coaches of a coaching workspace: the plan, its limits, and whether writes are allowed. */
export interface Billing {
  plan: PlanId
  status: BillingStatus
  writable: boolean
  /** Free coaches and studio owners pay; studio coaches only see the status. */
  canManage: boolean
  trialEndsAt: ISODate
  currentPeriodEnd?: ISODate
  extraStudentPacks: number
  extraCoachSeats: number
  /** Downgrades that take effect at the next renewal. */
  nextExtraStudentPacks?: number
  nextExtraCoachSeats?: number
  /** 'pro': the studio becomes a free coach at the next renewal. */
  nextPlan?: PlanId
  monthlyAmount: number
  studentLimit: number
  coachLimit: number
  /** The whole workspace's active students. */
  activeStudents: number
  /** Active students the caller cannot see (a studio coach sees only their own). */
  hiddenActiveStudents: number
  /** A NewebPay monthly mandate is running. */
  subscribed: boolean
  paymentsEnabled: boolean
}

export interface AppData {
  schemaVersion: number
  seededAt: ISODate
  coach: Coach
  students: Student[]
  relationships: CoachStudentRelationship[]
  exercises: Exercise[]
  plans: TrainingPlan[]
  workouts: WorkoutSession[]
  packages: SessionPackage[]
  transactions: SessionTransaction[]
  metrics: ProgressMetric[]
  appointments: Appointment[]
  /** Coaches only. Who teaches a student is relationships[].coachId. */
  studio?: Studio | null
  /** API mode, coaches only (absent in the offline demo and for self-trackers: no limits). */
  billing?: Billing | null
}

export interface DemoSession {
  role: Role
  /** For the student role: which student the demo is viewing as. */
  studentId: ID
  /** API mode only: bearer token issued by the backend. */
  token?: string
  /** API mode only: signed-in user's display name. */
  name?: string
  /** Offline demo only: acting as this studio coach, who sees only their own students. */
  coachId?: ID
  /** Offline demo only: which demo workspace (studio / solo / self) this identity lives in. */
  space?: 'studio' | 'solo' | 'self'
}
