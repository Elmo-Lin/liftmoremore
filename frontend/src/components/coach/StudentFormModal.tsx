import { useState } from 'react'
import { GENDER_LABEL, GOAL_LABEL } from '../../lib/format'
import { validateStudent, type StudentInput } from '../../store/actions'
import { useData, useToast } from '../../store/contexts'
import type { Gender, Student, TrainingGoal } from '../../types'
import { Button } from '../ui/Button'
import { SelectInput, TextArea, TextInput } from '../ui/Form'
import { Modal } from '../ui/Modal'

const EMPTY: StudentInput = {
  name: '',
  email: '',
  phone: '',
  gender: 'female',
  birthYear: undefined,
  heightCm: undefined,
  goal: 'general',
  goalDetail: '',
  weeklyFrequency: 2,
  coachNotes: '',
  status: 'active',
}

const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Number(v))

export function StudentFormModal({ open, onClose, student, onSaved }: { open: boolean; onClose: () => void; student?: Student; onSaved?: (s: Student) => void }) {
  if (!open) return null
  return <StudentForm key={student?.id ?? 'new'} onClose={onClose} student={student} onSaved={onSaved} />
}

function StudentForm({ onClose, student, onSaved }: { onClose: () => void; student?: Student; onSaved?: (s: Student) => void }) {
  const { data, actions } = useData()
  const notify = useToast()
  const [form, setForm] = useState<StudentInput>(() =>
    student
      ? {
          name: student.name,
          email: student.email,
          phone: student.phone ?? '',
          gender: student.gender,
          birthYear: student.birthYear,
          heightCm: student.heightCm,
          goal: student.goal,
          goalDetail: student.goalDetail,
          weeklyFrequency: student.weeklyFrequency,
          coachNotes: student.coachNotes,
          status: student.status,
        }
      : EMPTY,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const set = <K extends keyof StudentInput>(k: K, v: StudentInput[K]) => {
    const next = { ...form, [k]: v }
    setForm(next)
    if (submitted) setErrors(validateStudent(next, data.students.filter((s) => s.id !== student?.id)))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const errs = validateStudent(form, data.students.filter((s) => s.id !== student?.id))
    setErrors(errs)
    if (Object.keys(errs).length) return
    const res = student ? actions.updateStudent(student.id, form) : actions.addStudent(form)
    if (!res.ok) return notify(res.error, 'error')
    notify(student ? '學員資料已更新' : `已新增學員 ${res.value.name}`)
    onClose()
    onSaved?.(res.value)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={student ? '編輯學員' : '新增學員'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="h-11 md:h-10">
            取消
          </Button>
          <Button type="submit" form="student-form" className="h-11 md:h-10">
            {student ? '儲存變更' : '新增學員'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextInput label="姓名" required value={form.name} maxLength={30} onChange={(e) => set('name', e.target.value)} error={errors.name} />
        <TextInput label="Email" required type="email" inputMode="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
        <TextInput label="電話" type="tel" inputMode="tel" placeholder="09xx-xxx-xxx" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
        <SelectInput label="性別" value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
          {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
            <option key={g} value={g}>
              {GENDER_LABEL[g]}
            </option>
          ))}
        </SelectInput>
        <TextInput
          label="出生年"
          inputMode="numeric"
          placeholder="例如 1994"
          value={form.birthYear ?? ''}
          onChange={(e) => set('birthYear', numOrUndef(e.target.value.replace(/\D/g, '').slice(0, 4)))}
          error={errors.birthYear}
        />
        <TextInput
          label="身高 (cm)"
          inputMode="numeric"
          value={form.heightCm ?? ''}
          onChange={(e) => set('heightCm', numOrUndef(e.target.value.replace(/\D/g, '').slice(0, 3)))}
          error={errors.heightCm}
        />
        <SelectInput label="訓練目標" value={form.goal} onChange={(e) => set('goal', e.target.value as TrainingGoal)}>
          {(Object.keys(GOAL_LABEL) as TrainingGoal[]).map((g) => (
            <option key={g} value={g}>
              {GOAL_LABEL[g]}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          label="每週訓練頻率"
          value={form.weeklyFrequency}
          onChange={(e) => set('weeklyFrequency', Number(e.target.value))}
          error={errors.weeklyFrequency}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              每週 {n} 次
            </option>
          ))}
        </SelectInput>
        <TextInput
          label="目標說明"
          containerClassName="sm:col-span-2"
          placeholder="例如：半年內深蹲做到 100 kg"
          value={form.goalDetail}
          maxLength={80}
          onChange={(e) => set('goalDetail', e.target.value)}
        />
        <TextArea
          label="教練備註"
          hint="僅教練可見"
          containerClassName="sm:col-span-2"
          value={form.coachNotes}
          maxLength={500}
          onChange={(e) => set('coachNotes', e.target.value)}
        />
        <SelectInput label="狀態" value={form.status} onChange={(e) => set('status', e.target.value as StudentInput['status'])}>
          <option value="active">進行中</option>
          <option value="inactive">暫停</option>
        </SelectInput>
      </form>
    </Modal>
  )
}
