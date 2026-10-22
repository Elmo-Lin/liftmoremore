import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../../lib/format'
import { useData } from '../../store/contexts'
import type { ID, MuscleGroup } from '../../types'
import { inputClass } from '../ui/Form'
import { Modal } from '../ui/Modal'
import { EmptyState } from '../ui/Primitives'

export function ExercisePicker({
  open,
  onClose,
  onPick,
  existing = [],
}: {
  open: boolean
  onClose: () => void
  onPick: (exerciseId: ID) => void
  existing?: ID[]
}) {
  const { data } = useData()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all')

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return data.exercises.filter(
      (e) =>
        (group === 'all' || e.muscleGroup === group) &&
        (!term || e.name.includes(term) || e.nameEn.toLowerCase().includes(term)),
    )
  }, [data.exercises, q, group])

  const groups = Object.keys(MUSCLE_LABEL) as MuscleGroup[]

  return (
    <Modal open={open} onClose={onClose} title="新增動作" size="md">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋動作名稱（中文或英文）"
          className={`${inputClass} h-11 pl-9`}
          aria-label="搜尋動作"
        />
      </div>
      <div className="scrollbar-none -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
        {(['all', ...groups] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium ${
              group === g ? 'border-accent-600 bg-accent-600 text-white' : 'border-transparent bg-fill text-ink-800 hover:bg-[#7676802e]'
            }`}
          >
            {g === 'all' ? '全部' : MUSCLE_LABEL[g]}
          </button>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                onPick(e.id)
                onClose()
                setQ('')
              }}
              className="flex w-full items-center gap-3 py-3 text-left hover:bg-subtle/60 md:-mx-2 md:w-[calc(100%+1rem)] md:rounded-lg md:px-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-ink-900">{e.name}</p>
                <p className="text-xs text-ink-500">
                  {e.nameEn}・{MUSCLE_LABEL[e.muscleGroup]}・{EQUIPMENT_LABEL[e.equipment]}
                </p>
              </div>
              {existing.includes(e.id) && <span className="text-xs text-ink-400">已加入</span>}
              <Plus className="size-4 text-ink-400" />
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <EmptyState compact icon={Search} title="找不到符合的動作" description="試試其他關鍵字或肌群。" />}
    </Modal>
  )
}
