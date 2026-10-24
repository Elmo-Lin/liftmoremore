import { ClipboardList, Copy, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AssignPlanModal } from '../../components/coach/AssignPlanModal'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Avatar, Badge, Card, EmptyState, PageHeader } from '../../components/ui/Primitives'
import { formatDate, GOAL_LABEL } from '../../lib/format'
import { planMenu } from '../../lib/plans'
import { useData, useToast } from '../../store/contexts'
import { useExerciseMap } from '../../store/selectors'
import type { TrainingPlan } from '../../types'

/** Exercises listed on each plan card; the rest are counted. */
const MAX_CHIPS = 5

export function PlansPage() {
  const { data, actions } = useData()
  const exMap = useExerciseMap()
  const notify = useToast()
  const navigate = useNavigate()
  const [assigning, setAssigning] = useState<TrainingPlan | null>(null)
  const [deleting, setDeleting] = useState<TrainingPlan | null>(null)
  const plans = [...data.plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div>
      <PageHeader
        title="訓練計畫"
        description="建立可重複使用的計畫範本，並指派給學員"
        actions={
          <ButtonLink to="/coach/plans/new" icon={Plus}>
            建立計畫
          </ButtonLink>
        }
      />

      {plans.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="還沒有計畫"
            description="建立第一份計畫，之後記錄訓練時可直接帶入動作與組數。"
            action={
              <ButtonLink to="/coach/plans/new" icon={Plus}>
                建立計畫
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const assigned = data.students.filter((s) => s.activePlanId === p.id)
            const exercises = planMenu(p).exercises
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
                {/* What the menu trains: its first exercises. */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {exercises.slice(0, MAX_CHIPS).map((rx) => (
                    <span key={rx.id} className="rounded-md bg-subtle px-2 py-1 text-xs text-ink-600">
                      {exMap.get(rx.exerciseId)?.name ?? '未知動作'}
                    </span>
                  ))}
                  {exercises.length > MAX_CHIPS && <span className="px-1 py-1 text-xs text-ink-400">+{exercises.length - MAX_CHIPS}</span>}
                  {!exercises.length && <span className="py-1 text-xs text-ink-400">尚未加入動作</span>}
                </div>
                <p className="mt-3 text-xs text-ink-500">
                  {exercises.length} 個動作{p.weeks ? `・建議 ${p.weeks} 週` : ''}・更新於 {formatDate(p.updatedAt)}
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
                        <span className="text-xs whitespace-nowrap text-ink-600">{assigned.length} 位學員</span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-400">尚未指派</span>
                    )}
                  </button>
                  <div className="flex items-center gap-0.5">
                    {/* Icon-only on narrow phones; the student avatars on the left open the same dialog. */}
                    <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => setAssigning(p)} aria-label="指派">
                      <span className="hidden min-[400px]:inline">指派</span>
                    </Button>
                    <IconButton icon={Pencil} label="編輯" onClick={() => navigate(`/coach/plans/${p.id}`)} />
                    <IconButton
                      icon={Copy}
                      label="複製計畫"
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
          return n ? `目前有 ${n} 位學員使用此計畫，刪除後將取消指派。過去的訓練紀錄會保留。` : '過去的訓練紀錄會保留。'
        })()}
        confirmLabel="刪除"
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deletePlan(deleting.id)
          notify('計畫已刪除')
          setDeleting(null)
        }}
      />
    </div>
  )
}
