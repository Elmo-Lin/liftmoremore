import { ChevronRight, Clock, Ticket, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { durationMin, formatDate, formatTime, volumeKg } from '../../lib/format'
import { deductionFor } from '../../lib/sessions'
import { completedSets, workoutSetCount, workoutVolume } from '../../lib/stats'
import { useData, useToast } from '../../store/contexts'
import { selectStudent, selectTaughtBy, useExerciseMap, useIsSelf } from '../../store/selectors'
import type { WorkoutSession } from '../../types'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Form'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { Avatar, Badge } from '../ui/Primitives'
import { DeductSessionDialog } from './DeductSessionDialog'

export function WorkoutTypeBadge({ workout }: { workout: WorkoutSession }) {
  return workout.type === 'coached' ? <Badge tone="accent">教練課</Badge> : <Badge tone="alt">自主訓練</Badge>
}

export function DeductionBadge({ workout }: { workout: WorkoutSession }) {
  const { data } = useData()
  if (workout.type !== 'coached') return null
  return deductionFor(workout.id, data.transactions) ? (
    <Badge icon={Ticket}>已扣堂</Badge>
  ) : (
    <Badge tone="warn" icon={Ticket}>
      未扣堂
    </Badge>
  )
}

export function WorkoutRow({
  workout,
  onOpen,
  showStudent,
  showDeduction,
}: {
  workout: WorkoutSession
  onOpen: () => void
  showStudent?: boolean
  showDeduction?: boolean
}) {
  const { data } = useData()
  const student = showStudent ? selectStudent(data, workout.studentId) : undefined
  const taughtBy = selectTaughtBy(data, workout)
  const when = workout.completedAt ?? workout.startedAt
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-subtle/60">
      {student ? (
        <Avatar name={student.name} id={student.id} size="sm" />
      ) : (
        <span className="tabular flex w-10 shrink-0 flex-col items-center rounded-lg bg-subtle py-1 leading-tight">
          <span className="text-[10px] text-ink-500">{new Date(when).getMonth() + 1}月</span>
          <span className="text-[15px] font-semibold text-ink-800">{new Date(when).getDate()}</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium text-ink-900">
            {student ? `${student.name}・` : ''}
            {workout.title}
          </p>
          <WorkoutTypeBadge workout={workout} />
          {showDeduction && <DeductionBadge workout={workout} />}
        </div>
        <p className="tabular mt-0.5 text-xs text-ink-500">
          {student ? `${formatDate(when, { weekday: true })} ` : ''}
          {formatTime(workout.startedAt)}・{taughtBy ? `${taughtBy}・` : ''}{workout.exercises.length} 個動作・{workoutSetCount(workout)} 組・{volumeKg(workoutVolume(workout))}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-300" />
    </button>
  )
}

export function WorkoutDetailModal({
  workout,
  onClose,
  audience,
}: {
  workout: WorkoutSession | null
  onClose: () => void
  audience: 'coach' | 'student'
}) {
  const { data, actions } = useData()
  const notify = useToast()
  const exMap = useExerciseMap()
  const isSelf = useIsSelf()
  const [deducting, setDeducting] = useState(false)
  const [reversing, setReversing] = useState(false)
  const [reverseReason, setReverseReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (!workout) return null
  const current = data.workouts.find((w) => w.id === workout.id) ?? workout
  const deduction = deductionFor(current.id, data.transactions)
  const student = selectStudent(data, current.studentId)
  const mins = durationMin(current.startedAt, current.completedAt)
  const canDelete = audience === 'coach' || current.createdBy === 'student'

  return (
    <>
      <Modal
        open={!deducting}
        onClose={onClose}
        title={current.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            {audience === 'coach' && student && <span>{student.name}</span>}
            {selectTaughtBy(data, current) && <span>教練 {selectTaughtBy(data, current)}</span>}
            <span>{formatDate(current.completedAt ?? current.startedAt, { year: true, weekday: true })}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatTime(current.startedAt)}
              {mins ? `・${mins} 分鐘` : ''}
            </span>
          </span>
        }
        size="lg"
        footer={
          <>
            {canDelete && (
              <Button variant="destructive" icon={Trash2} className="h-11 md:mr-auto md:h-10" onClick={() => setDeleting(true)}>
                刪除紀錄
              </Button>
            )}
            <Button variant="secondary" className="h-11 md:h-10" onClick={onClose}>
              關閉
            </Button>
            {audience === 'coach' && deduction && (
              <Button variant="secondary" icon={Undo2} className="h-11 md:h-10" onClick={() => setReversing(true)}>
                撤銷扣堂
              </Button>
            )}
            {audience === 'coach' && current.type === 'coached' && !deduction && (
              <Button icon={Ticket} className="h-11 md:h-10" onClick={() => setDeducting(true)}>
                扣除 1 堂
              </Button>
            )}
          </>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {!isSelf && <WorkoutTypeBadge workout={current} />}
          {current.type === 'coached' && <DeductionBadge workout={current} />}
          {current.type === 'independent' && !isSelf && <Badge>不扣除堂數</Badge>}
          {!isSelf && <Badge>{current.createdBy === 'coach' ? '教練記錄' : '學員記錄'}</Badge>}
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-canvas p-3 text-center">
          <div>
            <p className="text-xs text-ink-500">動作</p>
            <p className="text-lg font-semibold text-ink-900">{current.exercises.length}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">完成組數</p>
            <p className="text-lg font-semibold text-ink-900">{workoutSetCount(current)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">訓練量</p>
            <p className="text-lg font-semibold text-ink-900">{volumeKg(workoutVolume(current))}</p>
          </div>
        </div>
        <div className="space-y-3">
          {current.exercises.map((e) => (
            <div key={e.id} className="rounded-lg border border-line">
              <p className="border-b border-line px-3 py-2 text-sm font-medium text-ink-900">{exMap.get(e.exerciseId)?.name}</p>
              <table className="tabular w-full text-sm">
                <tbody className="divide-y divide-line">
                  {completedSets(e.sets).map((s, i) => (
                    <tr key={s.id}>
                      <td className="w-12 px-3 py-1.5 text-ink-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-ink-900">{s.weightKg} kg</td>
                      <td className="px-3 py-1.5 text-ink-900">× {s.reps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        {current.notes && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-ink-500">備註</p>
            <p className="rounded-lg bg-canvas px-3 py-2 text-sm whitespace-pre-wrap text-ink-700">{current.notes}</p>
          </div>
        )}
      </Modal>

      {deducting && (
        <DeductSessionDialog
          workout={current}
          onClose={() => {
            setDeducting(false)
          }}
        />
      )}

      <ConfirmDialog
        open={reversing}
        title="撤銷此堂扣堂？"
        description="撤銷後會新增一筆「退回 1 堂」的紀錄，原扣堂紀錄仍會保留在歷史中。"
        confirmLabel="撤銷扣堂"
        onCancel={() => setReversing(false)}
        onConfirm={() => {
          const res = actions.reverseDeduction(current.id, reverseReason || '撤銷扣堂')
          if (!res.ok) return notify(res.error, 'error')
          setReversing(false)
          setReverseReason('')
          notify('已退回 1 堂')
        }}
      >
        <TextInput label="原因" placeholder="例如：誤扣、課程取消" value={reverseReason} maxLength={60} onChange={(e) => setReverseReason(e.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting}
        title="刪除這筆訓練紀錄？"
        description={deduction ? '此課程已扣堂。請先撤銷扣堂，再刪除紀錄。' : '刪除後無法復原。'}
        confirmLabel="刪除"
        tone="danger"
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          const res = actions.deleteWorkout(current.id)
          setDeleting(false)
          if (!res.ok) return notify(res.error, 'error')
          notify('已刪除訓練紀錄')
          onClose()
        }}
      />
    </>
  )
}
