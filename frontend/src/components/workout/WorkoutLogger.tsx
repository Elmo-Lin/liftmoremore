import {
  CircleCheck,
  ClipboardList,
  Clock,
  CopyPlus,
  Dumbbell,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { durationMin, formatDate, formatTime, relativeDay } from '../../lib/format'
import { uid } from '../../lib/id'
import { LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { lastExerciseLog, workoutDate } from '../../lib/stats'
import { useData, useToast } from '../../store/contexts'
import { selectBalance, selectCompleted, selectDrafts, selectPlan, selectStudent, useExerciseMap } from '../../store/selectors'
import type { ExerciseLog, ExercisePrescription, ID, Role, TrainingDay, TrainingPlan, WorkoutSession } from '../../types'
import { Button } from '../ui/Button'
import { inputClass, SelectInput, TextArea } from '../ui/Form'
import { ConfirmDialog } from '../ui/Modal'
import { Avatar, Badge, Card, EmptyState } from '../ui/Primitives'
import { DeductSessionDialog } from './DeductSessionDialog'
import { ExerciseCard, type SetSuggestion } from './ExerciseCard'
import { ExercisePicker } from './ExercisePicker'

function emptyWorkout(studentId: ID, mode: Role, coachId: ID): WorkoutSession {
  const now = new Date().toISOString()
  return {
    id: uid('wo'),
    studentId,
    coachId: mode === 'coach' ? coachId : undefined,
    type: mode === 'coach' ? 'coached' : 'independent',
    createdBy: mode,
    status: 'draft',
    title: '自由訓練',
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

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function WorkoutLogger({ mode, fixedStudentId }: { mode: Role; fixedStudentId?: ID }) {
  const { data, actions } = useData()
  const notify = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const exMap = useExerciseMap()

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
    const day = plan?.days.find((d) => d.id === params.get('day'))
    if (sid && plan && day && data.students.some((s) => s.id === sid)) {
      return { ...emptyWorkout(sid, mode, data.coach.id), title: day.name, planId: plan.id, trainingDayId: day.id, exercises: logsFromDay(day) }
    }
    return null
  })

  const [lastSaved, setLastSaved] = useState<string | null>(null)
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
  const day = plan?.days.find((d) => d.id === workout?.trainingDayId)

  const rxFor = (exerciseId: ID): ExercisePrescription | undefined => day?.exercises.find((r) => r.exerciseId === exerciseId)

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

  const start = (w: WorkoutSession) => {
    setWorkout(w)
    setParams({}, { replace: true })
  }

  const startFromDay = (p: TrainingPlan, d: TrainingDay) => {
    if (!student) return notify('請先選擇學員', 'error')
    start({ ...emptyWorkout(student.id, mode, data.coach.id), title: d.name, planId: p.id, trainingDayId: d.id, exercises: logsFromDay(d) })
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
    const completed: WorkoutSession = {
      ...workout,
      status: 'completed',
      completedAt: new Date().toISOString(),
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
      notify('自主訓練已儲存（不會扣除教練課堂數）')
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
                    <Button
                      size="sm"
                      onClick={() => {
                        setStudentId(d.studentId)
                        start(structuredClone(d))
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
              onChange={(e) => setStudentId(e.target.value)}
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
              <span>課表：{activePlan?.name ?? '未指派'}</span>
              {lastWorkout && <span>上次訓練：{relativeDay(workoutDate(lastWorkout))}</span>}
            </div>
          )}

          {!student ? (
            mode === 'coach' && <p className="mt-4 text-sm text-ink-500">選擇學員後，可從課表、上次訓練或空白開始。</p>
          ) : (
            <div className="mt-5 space-y-5">
              {activePlan ? (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-ink-700">
                    從課表開始<span className="ml-1.5 font-normal text-ink-500">{activePlan.name}</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activePlan.days.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => startFromDay(activePlan, d)}
                        className="flex items-center gap-3 rounded-xl border border-line-strong px-4 py-3.5 text-left transition-colors hover:border-accent-600 hover:bg-accent-50"
                      >
                        <ClipboardList className="size-5 shrink-0 text-accent-700" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium text-ink-900">{d.name}</p>
                          <p className="truncate text-xs text-ink-500">
                            {d.exercises.length} 個動作・{d.exercises.map((r) => exMap.get(r.exerciseId)?.name).slice(0, 3).join('、')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-ink-500">
                  {mode === 'coach' ? '此學員尚未指派課表，可從空白開始或到「訓練課表」指派。' : '教練尚未指派課表給你，可以從空白開始記錄。'}
                </p>
              )}

              {mode === 'coach' && <OtherPlanPicker excludeId={activePlan?.id} onStart={startFromDay} />}

              <div className="grid gap-2 sm:grid-cols-2">
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
              {workout.type === 'coached' ? <Badge tone="accent">教練課</Badge> : <Badge tone="alt">自主訓練</Badge>}
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
                {formatTime(workout.startedAt)} 開始・{elapsed ?? 0} 分鐘
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
          placeholder={mode === 'coach' ? '例如：深蹲深度改善，下次主項加 2.5 kg' : '今天的狀態、感受…'}
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
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 md:bottom-4">
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

function OtherPlanPicker({ excludeId, onStart }: { excludeId?: ID; onStart: (p: TrainingPlan, d: TrainingDay) => void }) {
  const { data } = useData()
  const [planId, setPlanId] = useState('')
  const plans = data.plans.filter((p) => p.id !== excludeId)
  const plan = plans.find((p) => p.id === planId)
  if (!plans.length) return null
  return (
    <details className="group rounded-xl border border-line px-4 py-3 open:pb-4">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-600 select-none group-open:mb-3">
        使用其他課表…
      </summary>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select aria-label="選擇課表" className={`${inputClass} h-11 sm:max-w-xs`} value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">選擇課表</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {plan?.days.map((d) => (
            <Button key={d.id} variant="secondary" className="h-11" onClick={() => onStart(plan, d)}>
              {d.name}
            </Button>
          ))}
        </div>
      </div>
    </details>
  )
}
