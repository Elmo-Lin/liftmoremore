import { Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../../lib/format'
import { isCoachRole } from '../../lib/roles'
import { validateExercise, type ExerciseInput } from '../../store/actions'
import { useData, useSession, useToast } from '../../store/contexts'
import type { Equipment, Exercise, ID, MuscleGroup } from '../../types'
import { Button, IconButton } from '../ui/Button'
import { inputClass, SelectInput, TextInput } from '../ui/Form'
import { Modal } from '../ui/Modal'
import { Badge, EmptyState } from '../ui/Primitives'

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; exercise: Exercise }

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
  const { session } = useSession()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all')
  const [view, setView] = useState<View>({ kind: 'list' })
  // Coaches add exercises for their workspace, self-trackers for themselves; students ask their coach.
  const canAuthor = isCoachRole(session?.role) || session?.role === 'self'

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return data.exercises.filter(
      (e) =>
        !e.archived &&
        (group === 'all' || e.muscleGroup === group) &&
        (!term || e.name.toLowerCase().includes(term) || e.nameEn.toLowerCase().includes(term)),
    )
  }, [data.exercises, q, group])

  const groups = Object.keys(MUSCLE_LABEL) as MuscleGroup[]

  const close = () => {
    onClose()
    setQ('')
    setView({ kind: 'list' })
  }
  const pick = (id: ID) => {
    onPick(id)
    close()
  }

  const title = view.kind === 'new' ? '新增自訂動作' : view.kind === 'edit' ? '編輯自訂動作' : '新增動作'

  return (
    <Modal open={open} onClose={close} title={title} size="md">
      {view.kind !== 'list' ? (
        <CustomExerciseForm
          key={view.kind === 'edit' ? view.exercise.id : 'new'}
          exercise={view.kind === 'edit' ? view.exercise : undefined}
          initial={{ name: q.trim(), nameEn: '', muscleGroup: group === 'all' ? 'legs' : group, equipment: 'barbell' }}
          onBack={() => setView({ kind: 'list' })}
          onCreated={pick}
        />
      ) : (
        <>
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
              <li key={e.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => pick(e.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left hover:bg-subtle/60 md:-ml-2 md:rounded-lg md:px-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[15px] font-medium text-ink-900">
                      <span className="truncate">{e.name}</span>
                      {e.custom && <Badge tone="alt">自訂</Badge>}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {[e.nameEn, MUSCLE_LABEL[e.muscleGroup], EQUIPMENT_LABEL[e.equipment]].filter(Boolean).join('・')}
                    </p>
                  </div>
                  {existing.includes(e.id) && <span className="text-xs text-ink-400">已加入</span>}
                  <Plus className="size-4 shrink-0 text-ink-400" />
                </button>
                {e.custom && canAuthor && <IconButton icon={Pencil} label={`編輯「${e.name}」`} size="sm" onClick={() => setView({ kind: 'edit', exercise: e })} />}
              </li>
            ))}
          </ul>
          {!list.length && (
            <EmptyState compact icon={Search} title="找不到符合的動作" description={canAuthor ? '可以新增成自訂動作。' : '試試其他關鍵字，或請教練新增這個動作。'} />
          )}
          {canAuthor && (
            <button
              type="button"
              onClick={() => setView({ kind: 'new' })}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong py-3 text-sm font-medium text-accent-700 hover:bg-subtle"
            >
              <Plus className="size-4" />
              {q.trim() ? `新增自訂動作「${q.trim()}」` : '找不到？新增自訂動作'}
            </button>
          )}
        </>
      )}
    </Modal>
  )
}

/** Add (then pick) or edit a custom exercise. Deleting archives it, so past workouts keep its name. */
function CustomExerciseForm({
  exercise,
  initial,
  onBack,
  onCreated,
}: {
  exercise?: Exercise
  initial: ExerciseInput
  onBack: () => void
  onCreated: (id: ID) => void
}) {
  const { data, actions } = useData()
  const notify = useToast()
  const [form, setForm] = useState<ExerciseInput>(
    exercise ? { name: exercise.name, nameEn: exercise.nameEn, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment } : initial,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateExercise(form, exercise ? data.exercises.filter((x) => x.id !== exercise.id) : data.exercises)
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (exercise) {
      const res = actions.updateCustomExercise(exercise.id, form)
      if (!res.ok) return notify(res.error, 'error')
      notify('已更新自訂動作')
      onBack()
    } else {
      const res = actions.addCustomExercise(form)
      if (!res.ok) return notify(res.error, 'error')
      notify(`已新增「${res.value.name}」`)
      onCreated(res.value.id)
    }
  }

  const archive = () => {
    if (!exercise) return
    const res = actions.archiveCustomExercise(exercise.id)
    if (!res.ok) return notify(res.error, 'error')
    notify(`已刪除「${exercise.name}」`)
    onBack()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3.5">
      <TextInput
        label="動作名稱"
        required
        autoFocus
        maxLength={40}
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        error={errors.name}
      />
      <TextInput label="英文名稱（選填）" maxLength={60} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} error={errors.nameEn} />
      <div className="grid grid-cols-2 gap-3">
        <SelectInput label="部位" value={form.muscleGroup} onChange={(e) => setForm({ ...form, muscleGroup: e.target.value as MuscleGroup })}>
          {(Object.keys(MUSCLE_LABEL) as MuscleGroup[]).map((g) => (
            <option key={g} value={g}>
              {MUSCLE_LABEL[g]}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="器材" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value as Equipment })}>
          {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => (
            <option key={k} value={k}>
              {EQUIPMENT_LABEL[k]}
            </option>
          ))}
        </SelectInput>
      </div>
      <p className="text-xs text-ink-500">自訂動作會出現在搜尋、訓練紀錄與進步追蹤。教練新增的動作，工作室的教練與學員都看得到。</p>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" className="h-11 md:h-10" onClick={onBack}>
          返回
        </Button>
        <Button type="submit" className="h-11 md:h-10">
          {exercise ? '儲存' : '新增並加入'}
        </Button>
      </div>
      {exercise && (
        <div className="border-t border-line pt-3 text-center">
          {confirmDelete ? (
            <p className="text-sm text-ink-600">
              刪除後不會再出現在選單，過去的紀錄仍會保留。
              <button type="button" onClick={archive} className="ml-2 font-medium text-danger-600 hover:underline">
                確定刪除
              </button>
            </p>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-ink-500 hover:text-danger-600 hover:underline">
              刪除這個自訂動作
            </button>
          )}
        </div>
      )}
    </form>
  )
}
