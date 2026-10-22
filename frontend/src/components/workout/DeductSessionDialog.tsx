import { ArrowRight, TriangleAlert } from 'lucide-react'
import { formatDate } from '../../lib/format'
import { deductionBlocker } from '../../lib/sessions'
import { useData, useToast } from '../../store/contexts'
import { selectBalance, selectStudent } from '../../store/selectors'
import type { WorkoutSession } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

/**
 * Deduction is always a separate, explicit confirmation — never a side effect
 * of saving a workout. Independent workouts are rejected by the action itself.
 */
export function DeductSessionDialog({
  workout,
  onClose,
  context = 'history',
}: {
  workout: WorkoutSession | null
  onClose: (deducted: boolean) => void
  context?: 'finish' | 'history'
}) {
  const { data, actions } = useData()
  const notify = useToast()
  if (!workout) return null

  const student = selectStudent(data, workout.studentId)
  const balance = selectBalance(data, workout.studentId)
  const blocker = deductionBlocker(workout, balance, data.transactions)
  const pkg = balance.nextPackage

  const confirm = () => {
    const res = actions.deductSession(workout.id)
    if (!res.ok) {
      notify(res.error, 'error')
      return
    }
    notify(`已扣除 1 堂，${student?.name} 剩餘 ${res.value.remaining} 堂`)
    onClose(true)
  }

  return (
    <Modal
      open
      onClose={() => onClose(false)}
      title={context === 'finish' ? '訓練已儲存，是否扣除一堂課？' : '扣除一堂課程'}
      description={
        context === 'finish'
          ? '記錄訓練與扣除堂數是分開的動作。若此次課程不需計費（例如試上或補課），可選擇暫不扣除，之後仍可在學員頁面扣堂。'
          : `${workout.title}・${formatDate(workout.completedAt ?? workout.startedAt, { weekday: true })}`
      }
      size="sm"
      footer={
        blocker ? (
          <Button onClick={() => onClose(false)} className="h-11 md:h-10">
            知道了
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onClose(false)} className="h-11 md:h-10">
              暫不扣除
            </Button>
            <Button variant="accent" onClick={confirm} className="h-11 md:h-10" data-autofocus>
              確認扣除 1 堂
            </Button>
          </>
        )
      }
    >
      <div className="rounded-xl border border-line bg-canvas p-4">
        <p className="text-[13px] text-ink-500">{student?.name} 的剩餘堂數</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="num text-[30px] text-ink-900">{balance.remaining}</span>
          {!blocker && (
            <>
              <ArrowRight className="size-5 text-ink-400" />
              <span className="num text-[30px] text-accent-700">{balance.remaining - 1}</span>
            </>
          )}
          <span className="text-sm text-ink-500">堂</span>
        </div>
        {pkg && !blocker && (
          <p className="mt-3 text-[13px] text-ink-600">
            將從「{pkg.pkg.name}」扣除（此方案剩 {pkg.remaining} 堂，依購買順序優先使用）
          </p>
        )}
      </div>
      {blocker && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-warn-50 px-3 py-2.5 text-sm text-warn-600">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {blocker}
        </p>
      )}
    </Modal>
  )
}
