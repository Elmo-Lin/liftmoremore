import {
  CalendarClock,
  CalendarPlus,
  Check,
  CircleCheck,
  ClipboardList,
  Clock,
  CopyPlus,
  Dumbbell,
  FilePlus2,
  Plus,
  Save,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { durationMin, formatDate, formatTime, isSameDay, relativeDay } from '../../lib/format'
import { uid } from '../../lib/id'
import { LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { lastExerciseLog, workoutDate } from '../../lib/stats'
import { planMenu } from '../../lib/plans'
import { useData, useToast } from '../../store/contexts'
import { selectBalance, selectCompleted, selectDrafts, selectPlan, selectStudent, useExerciseMap, useIsSelf } from '../../store/selectors'
import type { AppData, Appointment, ExerciseLog, ExercisePrescription, ID, Role, TrainingDay, TrainingPlan, WorkoutSession } from '../../types'
import { Button } from '../ui/Button'
import { inputClass, SelectInput, TextArea } from '../ui/Form'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { Avatar, Badge, Card, EmptyState } from '../ui/Primitives'
import { DeductSessionDialog } from './DeductSessionDialog'
import { DeleteDraftButton } from './DraftsCard'
import { ExerciseCard, type SetSuggestion } from './ExerciseCard'
import { ExercisePicker } from './ExercisePicker'

/** Plans shown as cards when starting a workout; the rest are in a dropdown. */
const PLAN_CARDS = 6

/** e.g. "10/24 訓練": the default name of a workout not started from a plan. */
const defaultTitle = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} 訓練`

function emptyWorkout(studentId: ID, mode: Role, coachId: ID): WorkoutSession {
  const today = new Date()
  const now = today.toISOString()
  return {
    id: uid('wo'),
    studentId,
    coachId: mode === 'coach' ? coachId : undefined,
    type: mode === 'coach' ? 'coached' : 'independent',
    createdBy: mode,
    status: 'draft',
    // Today's date by default; workouts started from plans use their names.
    title: defaultTitle(today),
    startedAt: now,
    updatedAt: now,
    exercises: [],
    notes: '',
  }
}

function logsFromDay(day: TrainingDay): ExerciseLog[] {
  return day.exercises.map((rx) => ({
    id: uid('el'),
    exerciseId: rx.exerciseId,
    sets: Array.from({ length: rx.sets }, () => ({ id: uid('set'), weightKg: null, reps: null, rpe: null, completed: false })),
  }))
}

function copyLogs(logs: ExerciseLog[]): ExerciseLog[] {
  return logs.map((l) => ({
    id: uid('el'),
    exerciseId: l.exerciseId,
    sets: l.sets
      .filter((s) => s.completed)
      .map((s) => ({ id: uid('set'), weightKg: s.weightKg, reps: s.reps, rpe: null, completed: false })),
  }))
}

const DAY_MS = 86_400_000

interface OpenClass {
  appt: Appointment
  /** Already being logged. */
  draft?: WorkoutSession
}

/** Classes a coached session can be logged for: still scheduled, from the past two weeks to tomorrow, nearest first. */
function openClasses(d: AppData, studentId: ID, now: Date): OpenClass[] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const from = today.getTime() - 14 * DAY_MS
  const to = today.getTime() + 2 * DAY_MS
  const at = (a: Appointment) => new Date(a.startAt).getTime()
  return d.appointments
    .filter((a) => a.studentId === studentId && a.status === 'scheduled' && at(a) >= from && at(a) < to)
    .filter((a) => !d.workouts.some((w) => w.appointmentId === a.id && w.status === 'completed'))
    .map((a) => ({ appt: a, draft: d.workouts.find((w) => w.appointmentId === a.id && w.status === 'draft') }))
    .sort((x, y) => Math.abs(at(x.appt) - now.getTime()) - Math.abs(at(y.appt) - now.getTime()))
}

/** Ties a new workout to its class; a class from an earlier day is logged on that day. */
function forClass(w: WorkoutSession, a: Appointment): WorkoutSession {
  const today = new Date()
  if (isSameDay(a.startAt, today) || new Date(a.startAt) > today) return { ...w, appointmentId: a.id }
  return { ...w, appointmentId: a.id, startedAt: a.startAt, title: w.title === defaultTitle(today) ? defaultTitle(new Date(a.startAt)) : w.title }
}

/** Where an unscheduled class probably took place: the student's last class, else the coach's. */
function lastLocation(d: AppData, studentId: ID) {
  const recent = [...d.appointments].sort((a, b) => b.startAt.localeCompare(a.startAt))
  return (recent.find((a) => a.studentId === studentId) ?? recent[0])?.location || '未指定地點'
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function WorkoutLogger({ mode, fixedStudentId }: { mode: 'coach' | 'student'; fixedStudentId?: ID }) {
  const { data, actions } = useData()
  const notify = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const exMap = useExerciseMap()
  const isSelf = useIsSelf()

  const [studentId, setStudentId] = useState<ID>(() => {
    if (fixedStudentId) return fixedStudentId
    const fromDraft = data.workouts.find((w) => w.id === params.get('draft'))?.studentId
    return fromDraft ?? params.get('student') ?? ''
  })

  const [workout, setWorkout] = useState<WorkoutSession | null>(() => {
    const draft = data.workouts.find((w) => w.id === params.get('draft') && w.status === 'draft')
    if (draft && (!fixedStudentId || draft.studentId === fixedStudentId)) return structuredClone(draft)
    const sid = fixedStudentId ?? params.get('student')
    const plan = selectPlan(data, params.get('plan') ?? undefined)
    // Coaches first pick the class (the plan is preselected for them). With a workout already in progress,
    // stay on the start screen (which lists it) rather than open a second one.
    if (mode !== 'coach' && sid && plan && data.students.some((s) => s.id === sid) && !selectDrafts(data, sid, mode).length) {
      const menu = planMenu(plan)
      return { ...emptyWorkout(sid, mode, data.coach.id), title: plan.name, planId: plan.id, trainingDayId: menu.id, exercises: logsFromDay(menu) }
    }
    return null
  })

  const [lastSaved, setLastSaved] = useState<string | null>(null)
  /** A new workout held back because the student already has one in progress (likely a duplicate). */
  const [pendingStart, setPendingStart] = useState<{ fresh: WorkoutSession; draft: WorkoutSession } | null>(null)
  /** Plan picked to start from; null = the student's assigned plan. */
  const [chosenPlan, setChosenPlan] = useState<ID | null>(() => params.get('plan'))
  /** Coaches: the class this session is for; null = today's nearest, 'adhoc' = an unscheduled class. */
  const [chosenClass, setChosenClass] = useState<ID | 'adhoc' | null>(() => params.get('appointment'))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState<number | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [removeIdx, setRemoveIdx] = useState<number | null>(null)
  const [deductWorkout, setDeductWorkout] = useState<WorkoutSession | null>(null)
  const now = useNow(30000)

  // Autosave drafts so an interrupted session can be resumed.
  useEffect(() => {
    if (!workout || workout.status !== 'draft' || !workout.exercises.length) return
    const t = setTimeout(() => {
      const res = actions.saveWorkout(workout)
      if (res.ok) setLastSaved(res.value.updatedAt)
    }, 700)
    return () => clearTimeout(t)
  }, [workout, actions])

  const student = selectStudent(data, workout?.studentId ?? studentId)
  const balance = student ? selectBalance(data, student.id) : null
  const plan = selectPlan(data, workout?.planId)
  const day = plan ? planMenu(plan) : undefined

  const rxFor = (exerciseId: ID): ExercisePrescription | undefined => day?.exercises.find((r) => r.exerciseId === exerciseId)

  // Coached sessions are logged for a scheduled class, so one class can't end up logged twice.
  const classes = mode === 'coach' && student && !workout ? openClasses(data, student.id, new Date(now)) : []
  const todaysClass = classes.find((c) => isSameDay(c.appt.startAt, new Date(now)))
  const selectedClass: OpenClass | 'adhoc' | undefined =
    chosenClass === 'adhoc' || (mode === 'coach' && student && !classes.length)
      ? 'adhoc'
      : classes.find((c) => c.appt.id === (chosenClass ?? todaysClass?.appt.id))
  const workoutClass = data.appointments.find((a) => a.id === workout?.appointmentId)

  const lastByExercise = useMemo(() => {
    const m = new Map<ID, { log: ExerciseLog; date: string }>()
    if (!workout) return m
    for (const e of workout.exercises) {
      if (m.has(e.exerciseId)) continue
      const hit = lastExerciseLog(data.workouts, workout.studentId, e.exerciseId, workout.id)
      if (hit) m.set(e.exerciseId, { log: hit.log, date: workoutDate(hit.workout) })
    }
    return m
  }, [data.workouts, workout])

  const suggestionsFor = (log: ExerciseLog): SetSuggestion[] => {
    const rx = rxFor(log.exerciseId)
    const lastSets = lastByExercise.get(log.exerciseId)?.log.sets.filter((s) => s.completed) ?? []
    const rxReps = rx ? parseInt(rx.reps, 10) : NaN
    return log.sets.map((_, i) => {
      const ls = lastSets[i] ?? lastSets[lastSets.length - 1]
      return {
        weightKg: rx?.targetWeightKg ?? ls?.weightKg ?? null,
        reps: ls?.reps ?? (Number.isFinite(rxReps) ? rxReps : null),
      }
    })
  }

  const patch = (fn: (w: WorkoutSession) => WorkoutSession) => setWorkout((w) => (w ? fn(w) : w))
  const setLog = (i: number, log: ExerciseLog) => patch((w) => ({ ...w, exercises: w.exercises.map((e, j) => (j === i ? log : e)) }))

  const begin = (w: WorkoutSession) => {
    setPendingStart(null)
    setWorkout(w)
    setParams({}, { replace: true })
  }

  const start = (w: WorkoutSession) => {
    let next = w
    if (mode === 'coach') {
      if (!selectedClass) return notify('請先選擇是哪一堂課', 'error')
      if (selectedClass !== 'adhoc') next = forClass(w, selectedClass.appt)
    }
    // An unfinished workout outside any class (classes show their own) usually means logging the session twice: ask first.
    const draft = selectDrafts(data, w.studentId, mode).find((d) => !d.appointmentId)
    if (draft) setPendingStart({ fresh: next, draft })
    else begin(next)
  }

  /** A plan is one menu: its exercises, sets and target weights come in, titled after the plan. */
  const startFromPlan = (p: TrainingPlan) => {
    if (!student) return notify('請先選擇學員', 'error')
    const menu = planMenu(p)
    start({ ...emptyWorkout(student.id, mode, data.coach.id), title: p.name, planId: p.id, trainingDayId: menu.id, exercises: logsFromDay(menu) })
  }

  const lastWorkout = student ? selectCompleted(data, student.id)[0] : undefined

  const totalSets = workout?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0
  const doneSets = workout?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0) ?? 0

  const saveDraft = () => {
    if (!workout) return
    const res = actions.saveWorkout({ ...workout, status: 'draft' })
    if (!res.ok) return notify(res.error, 'error')
    setLastSaved(res.value.updatedAt)
    notify('草稿已儲存，可隨時回來繼續')
    // Same place finishing goes; the draft waits at the top of that history list.
    navigate(mode === 'coach' ? `/coach/students/${workout.studentId}?tab=history` : '/student/history')
  }

  const requestFinish = () => {
    if (!workout) return
    if (!doneSets) return notify('請至少完成一組再結束訓練（點選每組右側的勾勾）', 'error')
    if (doneSets < totalSets) setConfirmFinish(totalSets - doneSets)
    else finish()
  }

  const finish = () => {
    if (!workout) return
    setConfirmFinish(null)
    const nowISO = new Date().toISOString()
    // A class from an earlier day ends that day, not when the coach got round to logging it.
    const completedAt = isSameDay(workout.startedAt, nowISO)
      ? nowISO
      : new Date(new Date(workout.startedAt).getTime() + (workoutClass?.durationMin ?? 60) * 60_000).toISOString()
    let appointmentId = workout.appointmentId
    if (mode === 'coach' && !appointmentId) {
      // An unscheduled class goes on the schedule, so every coached session has its class.
      const minutes = Math.min(240, Math.max(15, Math.round((durationMin(workout.startedAt, completedAt) ?? 0) / 15) * 15 || 60))
      const res = actions.saveAppointments([
        { id: uid('apt'), coachId: data.coach.id, studentId: workout.studentId, startAt: workout.startedAt, durationMin: minutes, location: lastLocation(data, workout.studentId), status: 'scheduled' },
      ])
      if (!res.ok) return notify(res.error, 'error')
      appointmentId = res.value[0].id
    }
    const completed: WorkoutSession = {
      ...workout,
      appointmentId,
      status: 'completed',
      completedAt,
      exercises: workout.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) }))
        .filter((e) => e.sets.length),
    }
    const res = actions.saveWorkout(completed)
    if (!res.ok) return notify(res.error, 'error')
    setWorkout(res.value)
    if (mode === 'coach') {
      setDeductWorkout(res.value)
    } else {
      notify(isSelf ? '訓練已儲存' : '自主訓練已儲存（不會扣除教練課堂數）')
      navigate('/student/history')
    }
  }

  const discard = () => {
    if (workout) actions.deleteWorkout(workout.id)
    setConfirmDiscard(false)
    setWorkout(null)
    setLastSaved(null)
    notify('已捨棄此次訓練', 'info')
  }

  // ------------------------------------------------------------------ setup
  if (!workout) {
    const drafts = selectDrafts(data, fixedStudentId, mode)
    const activeStudents = data.students.filter((s) => s.status === 'active')
    const activePlan = selectPlan(data, student?.activePlanId)
    // Coaches can start from any plan (the student's assigned one first), self-trackers from any of their own; students only from theirs.
    const startablePlans =
      mode === 'coach' || isSelf
        ? [...data.plans].sort((x, y) => Number(y.id === activePlan?.id) - Number(x.id === activePlan?.id) || y.updatedAt.localeCompare(x.updatedAt))
        : activePlan
          ? [activePlan]
          : []
    const selectedPlan = mode === 'coach' ? startablePlans.find((p) => p.id === (chosenPlan ?? activePlan?.id)) : undefined
    return (
      <div className="space-y-5">
        {drafts.length > 0 && (
          <Card>
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-[15px] font-semibold text-ink-900">未完成的訓練</h2>
              <p className="text-[13px] text-ink-500">訓練中斷時會自動保存草稿，可從這裡繼續。</p>
            </div>
            <ul className="divide-y divide-line">
              {drafts.map((d) => {
                const s = selectStudent(data, d.studentId)
                const done = d.exercises.reduce((n, e) => n + e.sets.filter((x) => x.completed).length, 0)
                return (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                    {s && <Avatar name={s.name} id={s.id} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {mode === 'coach' && s ? `${s.name}・` : ''}
                        {d.title}
                      </p>
                      <p className="text-xs text-ink-500">
                        {relativeDay(d.startedAt)} {formatTime(d.startedAt)} 開始・已完成 {done} 組
                      </p>
                    </div>
                    <DeleteDraftButton draft={d} />
                    <Button
                      size="sm"
                      onClick={() => {
                        setStudentId(d.studentId)
                        begin(structuredClone(d))
                      }}
                    >
                      繼續
                    </Button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">開始新的訓練</h2>
          {mode === 'coach' && (
            <SelectInput
              label="學員"
              required
              containerClassName="mt-4"
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value)
                setChosenPlan(null)
                setChosenClass(null)
              }}
              className="h-12 md:h-10"
            >
              <option value="">選擇學員…</option>
              {activeStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          )}

          {mode === 'coach' && student && balance && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-ink-600">
              <span>
                剩餘堂數 <strong className={`font-semibold ${balance.remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : 'text-ink-900'}`}>{balance.remaining}</strong> 堂
              </span>
              <span>計畫：{activePlan?.name ?? '未指派'}</span>
              {lastWorkout && <span>上次訓練：{relativeDay(workoutDate(lastWorkout))}</span>}
            </div>
          )}

          {mode === 'coach' && student && (
            <div className="mt-5">
              <p className="mb-2 text-[13px] font-medium text-ink-700">哪一堂課</p>
              <div role="radiogroup" aria-label="哪一堂課" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {classes.map((c) => (
                  <ChoiceCard
                    key={c.appt.id}
                    picked={selectedClass !== 'adhoc' && selectedClass?.appt.id === c.appt.id}
                    onPick={() => setChosenClass(c.appt.id)}
                    icon={CalendarClock}
                    title={`${relativeDay(c.appt.startAt)} ${formatTime(c.appt.startAt)}`}
                    badge={c.draft && <Badge tone="accent">記錄中</Badge>}
                    sub={`${c.appt.durationMin} 分鐘・${c.appt.location}`}
                  />
                ))}
                <ChoiceCard
                  picked={selectedClass === 'adhoc'}
                  onPick={() => setChosenClass('adhoc')}
                  icon={CalendarPlus}
                  title="未排課（臨時加課）"
                  sub={classes.length ? '完成後自動加入課表' : '近期沒有排課・完成後自動加入課表'}
                />
              </div>
            </div>
          )}

          {!student ? (
            mode === 'coach' && <p className="mt-4 text-sm text-ink-500">選擇學員後，先選是哪一堂課，再從計畫、上次訓練或空白開始。</p>
          ) : mode === 'coach' && !selectedClass ? (
            <p className="mt-4 text-sm text-ink-500">選擇是哪一堂課後，再從計畫、上次訓練或空白開始。</p>
          ) : selectedClass && selectedClass !== 'adhoc' && selectedClass.draft ? (
            <div className="mt-5 flex flex-col gap-3 rounded-xl bg-accent-50 px-4 py-3.5 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-ink-700">
                這堂課已經開始記錄「{selectedClass.draft.title}」，已完成{' '}
                {selectedClass.draft.exercises.reduce((n, e) => n + e.sets.filter((x) => x.completed).length, 0)} 組。
              </p>
              <Button className="h-12 sm:h-10" onClick={() => selectedClass.draft && begin(structuredClone(selectedClass.draft))}>
                繼續記錄
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {startablePlans.length ? (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-ink-700">從計畫開始</p>
                  <div role={mode === 'coach' ? 'radiogroup' : undefined} aria-label="從計畫開始" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {startablePlans.slice(0, PLAN_CARDS).map((p) => {
                      const menu = planMenu(p)
                      return (
                        <ChoiceCard
                          key={p.id}
                          // Students have one plan: a tap starts it. Coaches pick one, then start.
                          picked={mode === 'coach' ? selectedPlan?.id === p.id : undefined}
                          onPick={() => (mode === 'coach' ? setChosenPlan(p.id) : startFromPlan(p))}
                          icon={ClipboardList}
                          title={p.name}
                          badge={p.id === activePlan?.id && mode === 'coach' && <Badge tone="accent">已指派</Badge>}
                          sub={`${menu.exercises.length} 個動作${menu.exercises.length ? `・${menu.exercises.map((r) => exMap.get(r.exerciseId)?.name).slice(0, 3).join('、')}` : ''}`}
                        />
                      )
                    })}
                  </div>
                  {mode === 'coach' && (
                    <>
                      {startablePlans.length > PLAN_CARDS && (
                        <select
                          aria-label="其他計畫"
                          className={`${inputClass} mt-2 h-11 sm:max-w-xs`}
                          value={startablePlans.slice(PLAN_CARDS).some((p) => p.id === selectedPlan?.id) ? selectedPlan?.id : ''}
                          onChange={(e) => e.target.value && setChosenPlan(e.target.value)}
                        >
                          <option value="">其他計畫（{startablePlans.length - PLAN_CARDS}）…</option>
                          {startablePlans.slice(PLAN_CARDS).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="mt-3">
                        <Button className="h-12 w-full sm:h-11 sm:w-auto" disabled={!selectedPlan} onClick={() => selectedPlan && startFromPlan(selectedPlan)}>
                          {selectedPlan ? `開始「${selectedPlan.name}」` : '請先選擇計畫'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-ink-500">
                  {mode === 'coach' ? '還沒有訓練計畫，可以從空白開始，或到「訓練計畫」建立常用的菜單。' : isSelf ? '還沒有訓練計畫，可以從空白開始，或到「訓練計畫」建立常用的菜單。' : '教練尚未指派計畫給你，可以從空白開始記錄。'}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {lastWorkout && (
                  <button
                    type="button"
                    onClick={() =>
                      start({
                        ...emptyWorkout(student.id, mode, data.coach.id),
                        title: lastWorkout.title,
                        planId: lastWorkout.planId,
                        trainingDayId: lastWorkout.trainingDayId,
                        exercises: copyLogs(lastWorkout.exercises),
                      })
                    }
                    className="flex items-center gap-3 rounded-xl border border-line px-4 py-3.5 text-left hover:bg-subtle"
                  >
                    <CopyPlus className="size-5 shrink-0 text-ink-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">複製上次訓練</p>
                      <p className="truncate text-xs text-ink-500">
                        {lastWorkout.title}・{formatDate(workoutDate(lastWorkout))}・帶入重量與次數
                      </p>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => start(emptyWorkout(student.id, mode, data.coach.id))}
                  className="flex items-center gap-3 rounded-xl border border-line px-4 py-3.5 text-left hover:bg-subtle"
                >
                  <FilePlus2 className="size-5 shrink-0 text-ink-500" />
                  <div>
                    <p className="text-sm font-medium text-ink-900">空白開始</p>
                    <p className="text-xs text-ink-500">自行加入動作</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </Card>

        <Modal
          open={!!pendingStart}
          onClose={() => setPendingStart(null)}
          title="還有一筆未完成的訓練"
          description={(() => {
            if (!pendingStart) return undefined
            const d = pendingStart.draft
            const who = mode === 'coach' ? `${selectStudent(data, d.studentId)?.name ?? ''}的` : ''
            const done = d.exercises.reduce((n, e) => n + e.sets.filter((x) => x.completed).length, 0)
            return `${who}「${d.title}」${relativeDay(d.startedAt)} ${formatTime(d.startedAt)} 開始，已完成 ${done} 組。如果是同一堂課，請繼續這筆，避免重複記錄。`
          })()}
          size="sm"
          footer={
            <>
              <Button variant="ghost" className="h-11 md:mr-auto md:h-10" onClick={() => pendingStart && begin(pendingStart.fresh)}>
                仍要開始新的
              </Button>
              <Button className="h-11 md:h-10" onClick={() => pendingStart && begin(structuredClone(pendingStart.draft))}>
                繼續未完成的
              </Button>
            </>
          }
        />
      </div>
    )
  }

  // ----------------------------------------------------------------- logger
  const elapsed = durationMin(workout.startedAt, new Date(Math.max(now, new Date(workout.startedAt).getTime())).toISOString())

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          {student && <Avatar name={student.name} id={student.id} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-ink-500">{student?.name}</p>
              {workout.type === 'coached' ? <Badge tone="accent">教練課</Badge> : !isSelf && <Badge tone="alt">自主訓練</Badge>}
            </div>
            <input
              value={workout.title}
              onChange={(e) => patch((w) => ({ ...w, title: e.target.value }))}
              aria-label="訓練名稱"
              maxLength={40}
              className="mt-0.5 -ml-1 w-full rounded-md border border-transparent bg-transparent px-1 text-lg font-semibold text-ink-900 hover:border-line focus:border-accent-500 focus:outline-none"
            />
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {isSameDay(workout.startedAt, new Date(now))
                  ? `${formatTime(workout.startedAt)} 開始・${elapsed ?? 0} 分鐘`
                  : `補登 ${formatDate(workout.startedAt)} ${formatTime(workout.startedAt)} 的課`}
              </span>
              {plan && <span>{plan.name}</span>}
              {mode === 'coach' && balance && (
                <span className={balance.remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : ''}>剩餘 {balance.remaining} 堂</span>
              )}
              <span>{lastSaved ? `已自動儲存 ${formatTime(lastSaved)}` : '尚未儲存'}</span>
            </p>
          </div>
        </div>
      </Card>

      {workout.exercises.length === 0 ? (
        <Card>
          <EmptyState
            icon={Dumbbell}
            title="還沒有動作"
            description="加入第一個動作開始記錄。"
            action={
              <Button icon={Plus} onClick={() => setPickerOpen(true)}>
                新增動作
              </Button>
            }
          />
        </Card>
      ) : (
        workout.exercises.map((log, i) => (
          <ExerciseCard
            key={log.id}
            log={log}
            index={i}
            total={workout.exercises.length}
            exercise={exMap.get(log.exerciseId)}
            prescription={rxFor(log.exerciseId)}
            last={lastByExercise.get(log.exerciseId)}
            suggestions={suggestionsFor(log)}
            onChange={(l) => setLog(i, l)}
            onMove={(dir) =>
              patch((w) => {
                const ex = [...w.exercises]
                const j = i + dir
                if (j < 0 || j >= ex.length) return w
                ;[ex[i], ex[j]] = [ex[j], ex[i]]
                return { ...w, exercises: ex }
              })
            }
            onRemove={() => {
              if (log.sets.some((s) => s.completed)) setRemoveIdx(i)
              else patch((w) => ({ ...w, exercises: w.exercises.filter((_, j) => j !== i) }))
            }}
            onCopyLast={() => {
              const last = lastByExercise.get(log.exerciseId)
              if (!last) return
              setLog(i, { ...log, sets: copyLogs([last.log])[0].sets })
              notify('已帶入上次的重量與次數', 'info')
            }}
            onNeedReps={() => notify('請先輸入次數', 'error')}
          />
        ))
      )}

      {workout.exercises.length > 0 && (
        <Button variant="secondary" icon={Plus} className="h-12 w-full" onClick={() => setPickerOpen(true)}>
          新增動作
        </Button>
      )}

      <Card className="p-4 md:p-5">
        <TextArea
          label="訓練備註"
          value={workout.notes}
          maxLength={500}
          onChange={(e) => patch((w) => ({ ...w, notes: e.target.value }))}
        />
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-danger-600"
        >
          <Trash2 className="size-3.5" />
          捨棄此次訓練
        </button>
      </Card>

      {/* Sticky action bar — always reachable with one thumb */}
      {/* Phones: the bar is fixed just above the tab bar (sticky moved with the page and iOS overscroll);
          the spacer keeps the last content clear of it. Desktop: sticky at the bottom of the column. */}
      <div aria-hidden className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(50px+env(safe-area-inset-bottom))] z-30 px-4 pb-2 md:sticky md:inset-x-auto md:bottom-4 md:z-20 md:px-0 md:pb-0">
        <div className="flex items-center gap-2 material rounded-2xl ring-1 ring-black/5 p-2 shadow-xl shadow-black/10">
          <div className="hidden min-w-0 flex-1 px-2 sm:block">
            <p className="tabular text-sm font-medium text-ink-900">
              已完成 {doneSets} / {totalSets} 組
            </p>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-subtle">
              <div className="h-full rounded-full bg-accent-600 transition-all" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
            </div>
          </div>
          <Button variant="secondary" icon={Save} className="h-12 flex-1 sm:flex-none" onClick={saveDraft}>
            儲存草稿
          </Button>
          <Button variant="accent" icon={CircleCheck} className="h-12 flex-[1.4] sm:flex-none" onClick={requestFinish}>
            完成訓練
            <span className="tabular text-white/70 sm:hidden">
              {doneSets}/{totalSets}
            </span>
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existing={workout.exercises.map((e) => e.exerciseId)}
        onPick={(exerciseId) =>
          patch((w) => ({
            ...w,
            exercises: [
              ...w.exercises,
              {
                id: uid('el'),
                exerciseId,
                sets: Array.from({ length: 3 }, () => ({ id: uid('set'), weightKg: null, reps: null, rpe: null, completed: false })),
              },
            ],
          }))
        }
      />

      <ConfirmDialog
        open={confirmFinish != null}
        title="還有未完成的組數"
        description={`有 ${confirmFinish} 組尚未勾選完成。結束訓練後，未完成的組數不會被記錄。`}
        confirmLabel="結束並儲存"
        cancelLabel="繼續訓練"
        onConfirm={finish}
        onCancel={() => setConfirmFinish(null)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="捨棄此次訓練？"
        description="草稿與已輸入的資料將被刪除，無法復原。"
        confirmLabel="捨棄"
        tone="danger"
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
      <ConfirmDialog
        open={removeIdx != null}
        title="移除此動作？"
        description="此動作已有完成的組數，移除後將不會被記錄。"
        confirmLabel="移除"
        tone="danger"
        onConfirm={() => {
          const i = removeIdx
          setRemoveIdx(null)
          patch((w) => ({ ...w, exercises: w.exercises.filter((_, j) => j !== i) }))
        }}
        onCancel={() => setRemoveIdx(null)}
      />
      <DeductSessionDialog
        workout={deductWorkout}
        context="finish"
        onClose={(deducted) => {
          const sid = deductWorkout?.studentId
          setDeductWorkout(null)
          if (!deducted) notify('訓練已儲存，未扣除堂數', 'info')
          navigate(`/coach/students/${sid}?tab=history`)
        }}
      />
    </div>
  )
}

/** A choice on the start screen: a radio card when `picked` is given, else a plain button that acts at once. */
function ChoiceCard({
  picked,
  onPick,
  icon: Icon,
  title,
  badge,
  sub,
}: {
  picked?: boolean
  onPick: () => void
  icon: LucideIcon
  title: string
  badge?: ReactNode
  sub: string
}) {
  const radio = picked !== undefined
  return (
    <button
      type="button"
      role={radio ? 'radio' : undefined}
      aria-checked={radio ? picked : undefined}
      onClick={onPick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
        picked ? 'border-accent-600 bg-accent-50' : 'border-line-strong hover:border-accent-600 hover:bg-accent-50'
      }`}
    >
      <Icon className="size-5 shrink-0 text-accent-700" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[15px] font-medium text-ink-900">
          <span className="truncate">{title}</span>
          {badge}
        </p>
        <p className="truncate text-xs text-ink-500">{sub}</p>
      </div>
      {radio && (
        <span
          aria-hidden
          className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${picked ? 'border-accent-600 bg-accent-600 text-white' : 'border-ink-300'}`}
        >
          {picked && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}
    </button>
  )
}
