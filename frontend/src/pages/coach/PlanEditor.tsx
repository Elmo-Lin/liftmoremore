import { ArrowDown, ArrowLeft, ArrowUp, ClipboardX, Copy, Plus, Save, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AssignPlanModal } from '../../components/coach/AssignPlanModal'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { inputClass, SelectInput, TextArea, TextInput } from '../../components/ui/Form'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Card, EmptyState, PageHeader } from '../../components/ui/Primitives'
import { ExercisePicker } from '../../components/workout/ExercisePicker'
import { GOAL_LABEL } from '../../lib/format'
import { uid } from '../../lib/id'
import { useData, useToast } from '../../store/contexts'
import { selectPlan, useExerciseMap } from '../../store/selectors'
import type { ExercisePrescription, TrainingDay, TrainingGoal, TrainingPlan } from '../../types'

function newPlan(coachId: string): TrainingPlan {
  const now = new Date().toISOString()
  return {
    id: uid('plan'),
    coachId,
    authorRole: 'coach',
    name: '',
    description: '',
    goal: 'general',
    weeks: 8,
    days: [{ id: uid('day'), name: '訓練 A', focus: '', exercises: [] }],
    createdAt: now,
    updatedAt: now,
  }
}

const move = <T,>(arr: T[], i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function PlanEditorPage() {
  const { id } = useParams()
  const { data } = useData()
  const isNew = id === 'new'
  const existing = selectPlan(data, isNew ? undefined : id)
  if (!isNew && !existing) {
    return (
      <Card>
        <EmptyState icon={ClipboardX} title="找不到此計畫" description="計畫可能已被刪除。" action={<ButtonLink to="/coach/plans">回到計畫列表</ButtonLink>} />
      </Card>
    )
  }
  return <Editor key={id} initial={existing ? structuredClone(existing) : newPlan(data.coach.id)} isNew={isNew} />
}

function Editor({ initial, isNew }: { initial: TrainingPlan; isNew: boolean }) {
  const { data, actions } = useData()
  const notify = useToast()
  const navigate = useNavigate()
  const exMap = useExerciseMap()
  const [plan, setPlan] = useState(initial)
  const [dirty, setDirty] = useState(isNew)
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [removeDay, setRemoveDay] = useState<number | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [nameError, setNameError] = useState<string>()

  const edit = (fn: (p: TrainingPlan) => TrainingPlan) => {
    setPlan(fn)
    setDirty(true)
  }
  const editDay = (i: number, fn: (d: TrainingDay) => TrainingDay) => edit((p) => ({ ...p, days: p.days.map((d, j) => (j === i ? fn(d) : d)) }))
  const editRx = (di: number, ri: number, patch: Partial<ExercisePrescription>) =>
    editDay(di, (d) => ({ ...d, exercises: d.exercises.map((r, j) => (j === ri ? { ...r, ...patch } : r)) }))

  const save = (): TrainingPlan | null => {
    if (!plan.name.trim()) {
      setNameError('請輸入計畫名稱')
      notify('請輸入計畫名稱', 'error')
      return null
    }
    const res = actions.savePlan(plan)
    if (!res.ok) {
      notify(res.error, 'error')
      return null
    }
    setDirty(false)
    notify(isNew ? '計畫已建立' : '計畫已儲存')
    if (isNew) navigate(`/coach/plans/${res.value.id}`, { replace: true })
    return res.value
  }

  const assignedCount = data.students.filter((s) => s.activePlanId === plan.id).length
  const savedOnce = data.plans.some((p) => p.id === plan.id)

  return (
    <div>
      <PageHeader
        back={
          <button
            type="button"
            onClick={() => (dirty ? setLeaving(true) : navigate('/coach/plans'))}
            className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" />
            訓練計畫
          </button>
        }
        title={isNew ? '建立計畫' : '編輯計畫'}
        description={savedOnce ? `${assignedCount} 位學員使用中・修改會套用到之後的訓練，過去紀錄不受影響` : '儲存後即可指派給學員'}
        actions={
          <>
            {savedOnce && (
              <Button variant="secondary" icon={UserPlus} onClick={() => (dirty ? notify('請先儲存變更再指派', 'info') : setAssigning(true))}>
                指派學員
              </Button>
            )}
            <Button icon={Save} onClick={save} disabled={!dirty}>
              {dirty ? '儲存計畫' : '已儲存'}
            </Button>
          </>
        }
      />

      <Card className="grid gap-4 p-5 md:grid-cols-[2fr_1fr_1fr]">
        <TextInput
          label="計畫名稱"
          required
          value={plan.name}
          maxLength={40}
          placeholder="例如：上下半身分化 4 日"
          error={nameError}
          onChange={(e) => {
            setNameError(undefined)
            edit((p) => ({ ...p, name: e.target.value }))
          }}
        />
        <SelectInput label="目標" value={plan.goal} onChange={(e) => edit((p) => ({ ...p, goal: e.target.value as TrainingGoal }))}>
          {(Object.keys(GOAL_LABEL) as TrainingGoal[]).map((g) => (
            <option key={g} value={g}>
              {GOAL_LABEL[g]}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="建議週數" value={plan.weeks ?? ''} onChange={(e) => edit((p) => ({ ...p, weeks: e.target.value ? Number(e.target.value) : undefined }))}>
          <option value="">不限</option>
          {[4, 6, 8, 10, 12, 16].map((w) => (
            <option key={w} value={w}>
              {w} 週
            </option>
          ))}
        </SelectInput>
        <TextArea
          label="說明"
          containerClassName="md:col-span-3"
          className="min-h-16"
          value={plan.description}
          maxLength={200}
          placeholder="計畫目的、適合對象、進步方式…"
          onChange={(e) => edit((p) => ({ ...p, description: e.target.value }))}
        />
      </Card>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-900">訓練日（{plan.days.length}）</h2>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={() =>
            edit((p) => ({ ...p, days: [...p.days, { id: uid('day'), name: `訓練 ${String.fromCharCode(65 + p.days.length)}`, focus: '', exercises: [] }] }))
          }
        >
          新增訓練日
        </Button>
      </div>

      <div className="space-y-4">
        {plan.days.map((day, di) => (
          <Card key={day.id}>
            <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center">
              <input
                aria-label="訓練日名稱"
                value={day.name}
                maxLength={20}
                placeholder="訓練日名稱"
                onChange={(e) => editDay(di, (d) => ({ ...d, name: e.target.value }))}
                className={`${inputClass} h-10 font-medium sm:max-w-48 ${!day.name.trim() ? 'border-danger-600' : ''}`}
              />
              <input
                aria-label="訓練重點"
                value={day.focus ?? ''}
                maxLength={30}
                placeholder="重點（選填），例如：蹲為主"
                onChange={(e) => editDay(di, (d) => ({ ...d, focus: e.target.value }))}
                className={`${inputClass} h-10 sm:flex-1`}
              />
              <div className="flex items-center justify-end">
                <IconButton icon={ArrowUp} label="上移訓練日" disabled={di === 0} onClick={() => edit((p) => ({ ...p, days: move(p.days, di, -1) }))} />
                <IconButton icon={ArrowDown} label="下移訓練日" disabled={di === plan.days.length - 1} onClick={() => edit((p) => ({ ...p, days: move(p.days, di, 1) }))} />
                <IconButton
                  icon={Copy}
                  label="複製訓練日"
                  onClick={() =>
                    edit((p) => {
                      const copy = { ...structuredClone(day), id: uid('day'), name: `${day.name} 副本` }
                      copy.exercises = copy.exercises.map((r) => ({ ...r, id: uid('rx') }))
                      const days = [...p.days]
                      days.splice(di + 1, 0, copy)
                      return { ...p, days }
                    })
                  }
                />
                <IconButton
                  icon={Trash2}
                  label="刪除訓練日"
                  tone="danger"
                  disabled={plan.days.length === 1}
                  onClick={() => (day.exercises.length ? setRemoveDay(di) : edit((p) => ({ ...p, days: p.days.filter((_, j) => j !== di) })))}
                />
              </div>
            </div>

            {day.exercises.length > 0 && (
              <div className="hidden grid-cols-[1.5rem_1fr_4.5rem_5rem_5.5rem_1fr_5.5rem] gap-2 px-4 pt-3 text-[11px] font-medium text-ink-400 lg:grid">
                <span />
                <span>動作</span>
                <span>組數</span>
                <span>次數</span>
                <span>目標重量</span>
                <span>備註</span>
                <span />
              </div>
            )}
            <ul className="divide-y divide-line lg:divide-y-0">
              {day.exercises.map((rx, ri) => (
                <li key={rx.id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 px-4 py-3 lg:grid-cols-[1.5rem_1fr_4.5rem_5rem_5.5rem_1fr_5.5rem] lg:py-2">
                  <span className="tabular text-xs text-ink-400">{ri + 1}</span>
                  <p className="truncate text-sm font-medium text-ink-900">{exMap.get(rx.exerciseId)?.name}</p>
                  <div className="col-span-3 col-start-1 row-start-2 grid grid-cols-3 gap-2 pl-8 lg:contents">
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-ink-400 lg:hidden">組數</span>
                      <input
                        aria-label="組數"
                        inputMode="numeric"
                        value={rx.sets || ''}
                        onChange={(e) => editRx(di, ri, { sets: Math.min(20, Number(e.target.value.replace(/\D/g, '')) || 0) })}
                        className={`${inputClass} tabular h-10 text-center ${!rx.sets ? 'border-danger-600' : ''}`}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-ink-400 lg:hidden">次數</span>
                      <input
                        aria-label="次數"
                        value={rx.reps}
                        maxLength={7}
                        placeholder="8-10"
                        onChange={(e) => editRx(di, ri, { reps: e.target.value.replace(/[^0-9-]/g, '') })}
                        className={`${inputClass} tabular h-10 text-center`}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-ink-400 lg:hidden">目標 kg</span>
                      <input
                        aria-label="目標重量 kg"
                        inputMode="decimal"
                        value={rx.targetWeightKg ?? ''}
                        placeholder="—"
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9.]/g, '')
                          editRx(di, ri, { targetWeightKg: v ? Math.min(500, Number(v)) : undefined })
                        }}
                        className={`${inputClass} tabular h-10 text-center`}
                      />
                    </label>
                  </div>
                  <div className="col-span-3 col-start-1 row-start-3 pl-8 lg:col-span-1 lg:col-start-auto lg:row-start-auto lg:pl-0">
                    <input
                      aria-label="動作備註"
                      value={rx.notes ?? ''}
                      maxLength={60}
                      placeholder="備註（選填）"
                      onChange={(e) => editRx(di, ri, { notes: e.target.value })}
                      className={`${inputClass} h-10`}
                    />
                  </div>
                  <div className="col-start-3 row-start-1 flex justify-end lg:col-start-auto lg:row-start-auto">
                    <IconButton icon={ArrowUp} label="上移" size="sm" disabled={ri === 0} onClick={() => editDay(di, (d) => ({ ...d, exercises: move(d.exercises, ri, -1) }))} />
                    <IconButton icon={ArrowDown} label="下移" size="sm" disabled={ri === day.exercises.length - 1} onClick={() => editDay(di, (d) => ({ ...d, exercises: move(d.exercises, ri, 1) }))} />
                    <IconButton icon={Trash2} label="移除" size="sm" tone="danger" onClick={() => editDay(di, (d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== ri) }))} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="p-4 pt-2">
              <button
                type="button"
                onClick={() => setPickerFor(di)}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-sm font-medium text-ink-600 hover:border-accent-500 hover:bg-accent-50 hover:text-accent-700"
              >
                <Plus className="size-4" />
                新增動作
              </button>
            </div>
          </Card>
        ))}
      </div>

      {dirty && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-6 md:bottom-4">
          <div className="flex items-center gap-3 material rounded-2xl ring-1 ring-black/5 p-2 pl-4 shadow-xl shadow-black/10">
            <p className="flex-1 text-sm text-ink-600">有尚未儲存的變更</p>
            <Button icon={Save} className="h-11" onClick={save}>
              儲存計畫
            </Button>
          </div>
        </div>
      )}

      <ExercisePicker
        open={pickerFor != null}
        onClose={() => setPickerFor(null)}
        existing={pickerFor != null ? plan.days[pickerFor]?.exercises.map((r) => r.exerciseId) : []}
        onPick={(exerciseId) => {
          const di = pickerFor
          if (di == null) return
          editDay(di, (d) => ({ ...d, exercises: [...d.exercises, { id: uid('rx'), exerciseId, sets: 3, reps: '10', restSec: 90 }] }))
        }}
      />
      <ConfirmDialog
        open={removeDay != null}
        title="刪除此訓練日？"
        description="此訓練日的所有動作設定都會被移除。"
        confirmLabel="刪除"
        tone="danger"
        onCancel={() => setRemoveDay(null)}
        onConfirm={() => {
          const i = removeDay
          setRemoveDay(null)
          edit((p) => ({ ...p, days: p.days.filter((_, j) => j !== i) }))
        }}
      />
      <Modal
        open={leaving}
        onClose={() => setLeaving(false)}
        title="離開前要儲存嗎？"
        description="你有尚未儲存的計畫變更。"
        size="sm"
        footer={
          <>
            <Button variant="ghost" className="h-11 md:mr-auto md:h-10" onClick={() => setLeaving(false)}>
              繼續編輯
            </Button>
            <Button variant="secondary" className="h-11 md:h-10" onClick={() => navigate('/coach/plans')}>
              不儲存離開
            </Button>
            <Button
              className="h-11 md:h-10"
              onClick={() => {
                setLeaving(false)
                if (save()) navigate('/coach/plans')
              }}
            >
              儲存並離開
            </Button>
          </>
        }
      />
      {assigning && <AssignPlanModal plan={plan} onClose={() => setAssigning(false)} />}
    </div>
  )
}
