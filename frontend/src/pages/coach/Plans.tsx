import { ClipboardList, Copy, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AssignPlanModal } from '../../components/coach/AssignPlanModal'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Avatar, Badge, Card, EmptyState, PageHeader } from '../../components/ui/Primitives'
import { formatDate, GOAL_LABEL } from '../../lib/format'
import { useData, useToast } from '../../store/contexts'
import type { TrainingPlan } from '../../types'

export function PlansPage() {
  const { data, actions } = useData()
  const notify = useToast()
  const navigate = useNavigate()
  const [assigning, setAssigning] = useState<TrainingPlan | null>(null)
  const [deleting, setDeleting] = useState<TrainingPlan | null>(null)
  const plans = [...data.plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div>
      <PageHeader
        title="訓練課表"
        description="建立可重複使用的課表範本，並指派給學員"
        actions={
          <ButtonLink to="/coach/plans/new" icon={Plus}>
            建立課表
          </ButtonLink>
        }
      />

      {plans.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="還沒有課表"
            description="建立第一份課表，之後記錄訓練時可直接帶入動作與組數。"
            action={
              <ButtonLink to="/coach/plans/new" icon={Plus}>
                建立課表
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const assigned = data.students.filter((s) => s.activePlanId === p.id)
            const exerciseCount = p.days.reduce((n, d) => n + d.exercises.length, 0)
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/coach/plans/${p.id}`} className="text-[15px] font-semibold text-ink-900 hover:underline">
                      {p.name}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-500">{p.description || '沒有說明'}</p>
                  </div>
                  <Badge tone="accent">{GOAL_LABEL[p.goal]}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.days.map((d) => (
                    <span key={d.id} className="rounded-md bg-subtle px-2 py-1 text-xs text-ink-600">
                      {d.name}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-ink-500">
                  {p.days.length} 個訓練日・{exerciseCount} 個動作{p.weeks ? `・建議 ${p.weeks} 週` : ''}・更新於 {formatDate(p.updatedAt)}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
                  <button type="button" onClick={() => setAssigning(p)} className="flex min-w-0 items-center gap-2 text-left">
                    {assigned.length ? (
                      <>
                        <span className="flex -space-x-2">
                          {assigned.slice(0, 4).map((s) => (
                            <span key={s.id} className="rounded-full ring-2 ring-surface">
                              <Avatar name={s.name} id={s.id} size="sm" />
                            </span>
                          ))}
                        </span>
                        <span className="text-xs text-ink-600">{assigned.length} 位學員</span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-400">尚未指派</span>
                    )}
                  </button>
                  <div className="flex items-center gap-0.5">
                    <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => setAssigning(p)}>
                      指派
                    </Button>
                    <IconButton icon={Pencil} label="編輯" onClick={() => navigate(`/coach/plans/${p.id}`)} />
                    <IconButton
                      icon={Copy}
                      label="複製課表"
                      onClick={() => {
                        const res = actions.duplicatePlan(p.id)
                        if (res.ok) notify(`已建立「${res.value.name}」`)
                        else notify(res.error, 'error')
                      }}
                    />
                    <IconButton icon={Trash2} label="刪除" tone="danger" onClick={() => setDeleting(p)} />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {assigning && <AssignPlanModal plan={assigning} onClose={() => setAssigning(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`刪除「${deleting?.name}」？`}
        description={(() => {
          const n = data.students.filter((s) => s.activePlanId === deleting?.id).length
          return n ? `目前有 ${n} 位學員使用此課表，刪除後將取消指派。過去的訓練紀錄會保留。` : '過去的訓練紀錄會保留。'
        })()}
        confirmLabel="刪除"
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deletePlan(deleting.id)
          notify('課表已刪除')
          setDeleting(null)
        }}
      />
    </div>
  )
}
