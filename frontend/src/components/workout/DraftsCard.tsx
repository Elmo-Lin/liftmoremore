import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatTime, relativeDay } from '../../lib/format'
import { useData, useToast } from '../../store/contexts'
import { selectDrafts } from '../../store/selectors'
import type { ID, WorkoutSession } from '../../types'
import { ButtonLink, IconButton } from '../ui/Button'
import { ConfirmDialog } from '../ui/Modal'
import { Card } from '../ui/Primitives'

/** Deletes a draft saved by mistake, after a confirmation. */
export function DeleteDraftButton({ draft }: { draft: WorkoutSession }) {
  const { actions } = useData()
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const done = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)
  return (
    <>
      <IconButton icon={Trash2} label={`刪除草稿「${draft.title}」`} size="sm" tone="danger" onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        title="刪除這份草稿？"
        description={`「${draft.title}」${done ? `已記錄的 ${done} 組` : ''}會一併刪除，無法復原。`}
        confirmLabel="刪除"
        tone="danger"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          const res = actions.deleteWorkout(draft.id)
          notify(res.ok ? '已刪除草稿' : res.error, res.ok ? 'info' : 'error')
        }}
      />
    </>
  )
}

/** Saved-but-unfinished workouts at the top of a history list, each with a way back into the logger. */
export function DraftsCard({ studentId, createdBy, loggerPath, className = '' }: { studentId: ID; createdBy: 'coach' | 'student'; loggerPath: string; className?: string }) {
  const { data } = useData()
  const drafts = selectDrafts(data, studentId, createdBy)
  if (!drafts.length) return null
  return (
    <Card className={className}>
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-[15px] font-semibold text-ink-900">未完成的訓練</h2>
        <p className="text-[13px] text-ink-500">已儲存的草稿，可以從這裡繼續記錄。</p>
      </div>
      <ul className="divide-y divide-line">
        {drafts.map((d) => {
          const done = d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)
          return (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{d.title}</p>
                <p className="text-xs text-ink-500">
                  {relativeDay(d.startedAt)} {formatTime(d.startedAt)} 開始・已完成 {done} 組
                </p>
              </div>
              <DeleteDraftButton draft={d} />
              <ButtonLink size="sm" to={`${loggerPath}?draft=${d.id}`}>
                繼續
              </ButtonLink>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
