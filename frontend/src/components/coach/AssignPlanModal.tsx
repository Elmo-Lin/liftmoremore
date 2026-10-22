import { Check } from 'lucide-react'
import { useState } from 'react'
import { useData, useToast } from '../../store/contexts'
import { selectPlan } from '../../store/selectors'
import type { TrainingPlan } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Avatar, Badge } from '../ui/Primitives'

export function AssignPlanModal({ plan, onClose }: { plan: TrainingPlan; onClose: () => void }) {
  const { data, actions } = useData()
  const notify = useToast()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(data.students.filter((s) => s.activePlanId === plan.id).map((s) => s.id)))

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = () => {
    const res = actions.assignPlan(plan.id, [...selected])
    if (!res.ok) return notify(res.error, 'error')
    notify(`「${plan.name}」已指派給 ${selected.size} 位學員`)
    onClose()
  }

  const students = [...data.students].sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1))

  return (
    <Modal
      open
      onClose={onClose}
      title="指派課表"
      description={`${plan.name}・每位學員同時只會有一份進行中的課表`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="h-11 md:h-10">
            取消
          </Button>
          <Button onClick={save} className="h-11 md:h-10">
            儲存指派（{selected.size} 位）
          </Button>
        </>
      }
    >
      <ul className="space-y-1.5">
        {students.map((s) => {
          const on = selected.has(s.id)
          const other = s.activePlanId && s.activePlanId !== plan.id ? selectPlan(data, s.activePlanId) : undefined
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${on ? 'border-accent-600 bg-accent-50' : 'border-line hover:bg-subtle'}`}
              >
                <Avatar name={s.name} id={s.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                    {s.name}
                    {s.status === 'inactive' && <Badge>暫停</Badge>}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {other ? (on ? `將取代「${other.name}」` : `目前：${other.name}`) : on ? '已指派' : '未指派課表'}
                  </p>
                </div>
                <span className={`inline-flex size-5 items-center justify-center rounded border ${on ? 'border-accent-600 bg-accent-600 text-white' : 'border-line-strong'}`}>
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
