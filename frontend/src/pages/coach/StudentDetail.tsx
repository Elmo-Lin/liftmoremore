import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  History,
  Mail,
  Pause,
  Pencil,
  Phone,
  Play,
  Trash2,
  UserRoundX,
} from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { InviteStudentButton } from '../../components/coach/InviteStudentButton'
import { SessionPackagesPanel } from '../../components/coach/SessionPackagesPanel'
import { StudentFormModal } from '../../components/coach/StudentFormModal'
import { PRTable } from '../../components/progress/PRTable'
import { Button, ButtonLink } from '../../components/ui/Button'
import { SelectInput, TextArea } from '../../components/ui/Form'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Avatar, Badge, BalanceMeter, Card, CardHeader, EmptyState, PageHeader, Tabs } from '../../components/ui/Primitives'
import { PageLoading } from '../../components/ui/PageLoading'
import { DraftsCard } from '../../components/workout/DraftsCard'
import { PlanDayView } from '../../components/workout/PlanDayView'
import { WorkoutDetailModal, WorkoutRow } from '../../components/workout/WorkoutDetail'
import { formatDate, formatTime, GENDER_LABEL, GOAL_LABEL, relativeDay } from '../../lib/format'
import { deductionFor, LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { planMenu } from '../../lib/plans'
import { personalRecords, weeklyBuckets, workoutDate } from '../../lib/stats'
import { useData, useSession, useToast } from '../../store/contexts'
import { selectBalance, selectCoachName, selectCoachOf, selectCompleted, selectNextAppointment, selectPlan, selectStudent } from '../../store/selectors'
import type { Student, WorkoutSession } from '../../types'

const ProgressDashboard = lazy(() => import('../../components/progress/ProgressDashboard').then((m) => ({ default: m.ProgressDashboard })))

type TabKey = 'overview' | 'history' | 'plans' | 'packages' | 'progress'
const TAB_KEYS: TabKey[] = ['overview', 'history', 'plans', 'packages', 'progress']

export function StudentDetailPage() {
  const { id } = useParams()
  const { data, actions } = useData()
  const notify = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const student = selectStudent(data, id)

  const tabParam = params.get('tab') as TabKey | null
  const tab: TabKey = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : 'overview'

  if (!student) {
    return (
      <Card>
        <EmptyState
          icon={UserRoundX}
          title="找不到此學員"
          description="此學員可能已被刪除。"
          action={<ButtonLink to="/coach/students">回到學員列表</ButtonLink>}
        />
      </Card>
    )
  }

  const balance = selectBalance(data, student.id)
  const workouts = selectCompleted(data, student.id)
  // Opens the start screen with the assigned plan preselected, so the coach can still pick another.
  const startHref = `/coach/workouts/new?student=${student.id}`
  const pending = workouts.filter((w) => w.type === 'coached' && !deductionFor(w.id, data.transactions)).length

  const toggleStatus = () => {
    const next = student.status === 'active' ? 'inactive' : 'active'
    const res = actions.updateStudent(student.id, { status: next })
    notify(res.ok ? (next === 'active' ? `${student.name} 已恢復為進行中` : `${student.name} 已設為暫停`) : res.error, res.ok ? 'success' : 'error')
  }

  return (
    <div>
      <PageHeader
        back={
          <Link to="/coach/students" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
            <ArrowLeft className="size-4" />
            學員
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={student.name} id={student.id} size="lg" />
            <span>
              <span className="flex flex-wrap items-center gap-2">
                {student.name}
                {student.status === 'active' ? <Badge tone="accent">進行中</Badge> : <Badge>暫停</Badge>}
              </span>
              <span className="mt-1 block text-sm font-normal text-ink-500">
                {GOAL_LABEL[student.goal]}・每週 {student.weeklyFrequency} 次・剩 {balance.remaining} 堂
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              編輯
            </Button>
            <InviteStudentButton student={student} />
            <Button variant="secondary" icon={student.status === 'active' ? Pause : Play} onClick={toggleStatus}>
              {student.status === 'active' ? '設為暫停' : '恢復進行中'}
            </Button>
            {student.status === 'active' && (
              <ButtonLink to={startHref} icon={Dumbbell} variant="accent">
                開始訓練
              </ButtonLink>
            )}
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={(t) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })}
        tabs={[
          { value: 'overview', label: '總覽' },
          { value: 'history', label: '訓練紀錄', count: workouts.length },
          { value: 'plans', label: '訓練計畫' },
          { value: 'packages', label: '課程方案' },
          { value: 'progress', label: '進步分析' },
        ]}
      />

      <div className="mt-5">
        {tab === 'overview' && <Overview key={student.id} student={student} onTab={(t) => setParams({ tab: t })} pending={pending} />}
        {tab === 'history' && (
          <div className="space-y-4">
            <DraftsCard studentId={student.id} createdBy="coach" loggerPath="/coach/workouts/new" />
            <HistoryTab key={student.id} workouts={workouts} />
          </div>
        )}
        {tab === 'plans' && <PlansTab key={`${student.id}:${student.activePlanId}`} student={student} />}
        {tab === 'packages' && <SessionPackagesPanel studentId={student.id} />}
        {tab === 'progress' && (
          <Suspense fallback={<PageLoading />}>
            <ProgressDashboard studentId={student.id} audience="coach" />
            <Link
              to={`/coach/analytics?student=${student.id}`}
              className="mt-4 flex items-center justify-between rounded-xl bg-surface px-5 py-3.5 text-sm text-ink-700 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] hover:bg-raised"
            >
              查看數據分析：課程完成紀錄與學員總覽
              <ChevronRight className="size-4 text-ink-400" />
            </Link>
          </Suspense>
        )}
      </div>

      <div className="mt-10 border-t border-line pt-5">
        <Button variant="destructive" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
          刪除學員
        </Button>
      </div>

      <StudentFormModal open={editing} onClose={() => setEditing(false)} student={student} />
      <ConfirmDialog
        open={confirmDelete}
        title={`刪除 ${student.name}？`}
        description="此學員的訓練紀錄、課程方案與堂數異動都會一併刪除，無法復原。若只是暫時停課，建議改為「暫停」。"
        confirmLabel="永久刪除"
        tone="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          actions.deleteStudent(student.id)
          notify(`已刪除學員 ${student.name}`)
          navigate('/coach/students')
        }}
      />
    </div>
  )
}

function Overview({ student, onTab, pending }: { student: Student; onTab: (t: TabKey) => void; pending: number }) {
  const { data, actions } = useData()
  const notify = useToast()
  const [notes, setNotes] = useState(student.coachNotes)
  const [open, setOpen] = useState<WorkoutSession | null>(null)
  const balance = selectBalance(data, student.id)
  const workouts = useMemo(() => selectCompleted(data, student.id), [data, student.id])
  const prs = useMemo(() => personalRecords(workouts).slice(0, 5), [workouts])
  const next = selectNextAppointment(data, student.id)
  const plan = selectPlan(data, student.activePlanId)
  const recentWeeks = weeklyBuckets(workouts, 4)
  const avgPerWeek = recentWeeks.reduce((s, b) => s + b.coached + b.independent, 0) / 4
  const age = student.birthYear ? new Date().getFullYear() - student.birthYear : null
  const current = balance.packages.find((b) => b.remaining > 0) ?? balance.packages.at(-1)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card>
          <CardHeader title="訓練目標" />
          <div className="px-5 pb-5">
            <p className="text-[15px] font-medium text-ink-900">{GOAL_LABEL[student.goal]}</p>
            <p className="mt-1 text-sm text-ink-600">{student.goalDetail || '尚未填寫目標說明'}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-canvas py-2.5">
                <p className="text-xs text-ink-500">計畫頻率</p>
                <p className="mt-0.5 font-semibold text-ink-900">每週 {student.weeklyFrequency} 次</p>
              </div>
              <div className="rounded-lg bg-canvas py-2.5">
                <p className="text-xs text-ink-500">近 4 週實際</p>
                <p className="mt-0.5 font-semibold text-ink-900">每週 {avgPerWeek.toFixed(1)} 次</p>
              </div>
              <div className="rounded-lg bg-canvas py-2.5">
                <p className="text-xs text-ink-500">累計訓練</p>
                <p className="mt-0.5 font-semibold text-ink-900">{workouts.length} 次</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="教練備註" description="僅教練可見，學員端不會顯示" />
          <div className="px-5 pb-5">
            <TextArea label="備註內容" className="min-h-28" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                disabled={notes === student.coachNotes}
                onClick={() => {
                  const res = actions.updateStudent(student.id, { coachNotes: notes })
                  notify(res.ok ? '備註已儲存' : res.error, res.ok ? 'success' : 'error')
                }}
              >
                儲存備註
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="最近訓練"
            action={
              <Button variant="ghost" size="sm" icon={History} onClick={() => onTab('history')}>
                全部紀錄
              </Button>
            }
          />
          {workouts.length ? (
            <div className="divide-y divide-line border-t border-line">
              {workouts.slice(0, 5).map((w) => (
                <WorkoutRow key={w.id} workout={w} showDeduction onOpen={() => setOpen(w)} />
              ))}
            </div>
          ) : (
            <EmptyState compact icon={Dumbbell} title="尚無訓練紀錄" />
          )}
        </Card>

        <Card>
          <CardHeader title="個人紀錄" description="實際完成的最重一組；估算 1RM 僅供參考" />
          <PRTable prs={prs} />
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-ink-500">剩餘堂數</p>
            <button type="button" onClick={() => onTab('packages')} className="text-xs font-medium text-accent-700 hover:underline">
              管理方案
            </button>
          </div>
          <p className={`mt-1 num text-[32px] tracking-tight ${balance.remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : 'text-ink-900'}`}>
            {balance.remaining}
            <span className="ml-1 text-base font-normal text-ink-500">堂</span>
          </p>
          {current && (
            <>
              <div className="mt-3">
                <BalanceMeter remaining={current.remaining} total={current.total + Math.max(0, current.adjusted)} />
              </div>
              <p className="mt-2 text-xs text-ink-500">
                {current.pkg.name}・已用 {current.used} / {current.total} 堂
              </p>
            </>
          )}
          {balance.remaining <= LOW_BALANCE_THRESHOLD && <p className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-600">堂數偏低，建議提醒學員續約。</p>}
          {pending > 0 && (
            <button type="button" onClick={() => onTab('history')} className="mt-3 block w-full rounded-lg bg-subtle px-3 py-2 text-left text-xs text-ink-600 hover:bg-line">
              有 {pending} 堂教練課尚未扣堂，點此查看
            </button>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-[13px] text-ink-500">下次課程（示範排程）</p>
          {next ? (
            <p className="mt-1 flex items-center gap-2 text-[15px] font-medium text-ink-900">
              <CalendarDays className="size-4 text-ink-400" />
              {formatDate(next.startAt, { weekday: true })} {formatTime(next.startAt)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-400">尚無排程</p>
          )}
          <p className="mt-4 text-[13px] text-ink-500">目前計畫</p>
          <button type="button" onClick={() => onTab('plans')} className="mt-1 flex items-center gap-2 text-left text-[15px] font-medium text-ink-900 hover:underline">
            <ClipboardList className="size-4 text-ink-400" />
            {plan?.name ?? '未指派'}
          </button>
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-[13px] font-medium text-ink-700">基本資料</p>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2 text-ink-700">
              <Mail className="size-4 text-ink-400" />
              <a href={`mailto:${student.email}`} className="truncate hover:underline">
                {student.email}
              </a>
            </div>
            {student.phone && (
              <div className="flex items-center gap-2 text-ink-700">
                <Phone className="size-4 text-ink-400" />
                <a href={`tel:${student.phone}`} className="hover:underline">
                  {student.phone}
                </a>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 pt-2 text-center">
              <div>
                <dt className="text-xs text-ink-500">性別</dt>
                <dd className="font-medium text-ink-900">{GENDER_LABEL[student.gender]}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">年齡</dt>
                <dd className="font-medium text-ink-900">{age ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">身高</dt>
                <dd className="font-medium text-ink-900">{student.heightCm ? `${student.heightCm} cm` : '—'}</dd>
              </div>
            </div>
            <p className="pt-2 text-xs text-ink-500">
              加入於 {formatDate(student.joinedAt, { year: true })}
              {workouts[0] && `・上次訓練 ${relativeDay(workoutDate(workouts[0]))}`}
            </p>
          </dl>
        </Card>
        <CoachAssignment student={student} />
      </div>
      <WorkoutDetailModal workout={open} onClose={() => setOpen(null)} audience="coach" />
    </div>
  )
}

/** Studio owners: who teaches this student. Changing it hands over the student with all their history. */
function CoachAssignment({ student }: { student: Student }) {
  const { data, actions } = useData()
  const { session } = useSession()
  const notify = useToast()
  if (session?.role !== 'owner' || (data.studio?.coaches.length ?? 0) < 2) return null
  const current = selectCoachOf(data, student.id)
  const options = data.studio!.coaches.filter((c) => c.status === 'active' || c.id === current)
  return (
    <Card className="p-5">
      <SelectInput
        label="負責教練"
        value={current ?? ''}
        hint="轉給其他教練時，訓練紀錄、課表與堂數都會保留"
        onChange={(e) => {
          const to = e.target.value
          const res = actions.transferStudent(student.id, to)
          if (!res.ok) return notify(res.error, 'error')
          notify(`${student.name} 已轉給 ${selectCoachName(data, to)}`)
        }}
      >
        {options.map((c) => (
          <option key={c.id} value={c.id} disabled={c.status !== 'active'}>
            {c.name}
            {c.role === 'owner' ? '（經營者）' : ''}
            {c.status === 'inactive' ? '（已停用）' : ''}
          </option>
        ))}
      </SelectInput>
    </Card>
  )
}

type HistoryFilter = 'all' | 'coached' | 'independent' | 'pending'

/** What each filter shows, in plain words (the chips alone did not explain themselves). */
const FILTER_HINT: Record<HistoryFilter, string> = {
  all: '所有已完成的訓練。點一筆可以查看內容、扣堂或撤銷扣堂。',
  coached: '由教練帶的課，完成後可以扣除堂數。',
  independent: '學員自己記錄的訓練，不會扣除堂數。',
  pending: '已完成、但還沒扣堂的教練課。點進去就可以扣堂。',
}

function HistoryTab({ workouts }: { workouts: WorkoutSession[] }) {
  const { data } = useData()
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [open, setOpen] = useState<WorkoutSession | null>(null)
  const matches = (w: WorkoutSession, f: HistoryFilter) =>
    f === 'pending' ? w.type === 'coached' && !deductionFor(w.id, data.transactions) : f === 'all' || w.type === f
  const list = workouts.filter((w) => matches(w, filter))
  const filters: { value: HistoryFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'coached', label: '教練課' },
    { value: 'independent', label: '自主訓練' },
    { value: 'pending', label: '未扣堂' },
  ]

  if (!workouts.length) {
    return (
      <Card>
        <EmptyState icon={History} title="還沒有完成的訓練" description="按上方「開始訓練」記錄第一堂課；學員自己記錄的自主訓練也會出現在這裡。" />
      </Card>
    )
  }

  return (
    <div>
      {/* Filter chips, not tabs: they narrow the list below, with how many each one holds. */}
      <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="篩選訓練紀錄">
        {filters.map((f) => {
          const count = workouts.filter((w) => matches(w, f.value)).length
          const active = filter === f.value
          const attention = f.value === 'pending' && count > 0
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.value)}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ${
                active ? 'bg-accent-600 text-white' : 'bg-fill text-ink-800 hover:bg-[#7676802e]'
              }`}
            >
              {f.label}
              <span className={`tabular rounded-full px-1.5 text-[11px] ${active ? 'bg-white/25' : attention ? 'bg-warn-100 text-warn-600' : 'bg-black/6 text-ink-500'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 mb-3 text-[13px] text-ink-500">{FILTER_HINT[filter]}</p>
      <Card>
        {list.length ? (
          <div className="divide-y divide-line">
            {list.map((w) => (
              <WorkoutRow key={w.id} workout={w} showDeduction onOpen={() => setOpen(w)} />
            ))}
          </div>
        ) : (
          <EmptyState compact icon={History} title={filter === 'pending' ? '教練課都已扣堂' : filter === 'independent' ? '學員還沒有自主訓練紀錄' : '還沒有教練課紀錄'} />
        )}
      </Card>
      <WorkoutDetailModal workout={open} onClose={() => setOpen(null)} audience="coach" />
    </div>
  )
}

function PlansTab({ student }: { student: Student }) {
  const { data, actions } = useData()
  const notify = useToast()
  const plan = selectPlan(data, student.activePlanId)
  const [choice, setChoice] = useState(student.activePlanId ?? '')

  const assign = () => {
    if (!choice) {
      actions.updateStudent(student.id, { activePlanId: undefined })
      notify('已取消指派計畫', 'info')
      return
    }
    const others = data.students.filter((s) => s.activePlanId === choice && s.id !== student.id).map((s) => s.id)
    const res = actions.assignPlan(choice, [...others, student.id])
    notify(res.ok ? `已將「${selectPlan(data, choice)?.name}」指派給 ${student.name}` : res.error, res.ok ? 'success' : 'error')
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <SelectInput label="指派計畫" containerClassName="flex-1" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">不指派</option>
            {data.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
          <Button onClick={assign} disabled={choice === (student.activePlanId ?? '')}>
            套用
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-500">學員可在自己的頁面檢視計畫內容，但無法修改教練撰寫的計畫。</p>
      </Card>
      {plan ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">{plan.name}</h3>
              <p className="text-sm text-ink-500">{plan.description}</p>
            </div>
            <ButtonLink to={`/coach/plans/${plan.id}`} variant="secondary" size="sm" icon={Pencil}>
              編輯計畫
            </ButtonLink>
          </div>
          <PlanDayView
            day={{ ...planMenu(plan), name: `${planMenu(plan).exercises.length} 個動作` }}
            action={
              student.status === 'active' && (
                <ButtonLink to={`/coach/workouts/new?student=${student.id}&plan=${plan.id}`} size="sm" variant="secondary" icon={Play}>
                  開始訓練
                </ButtonLink>
              )
            }
          />
        </>
      ) : (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="尚未指派計畫"
            description="從上方選擇計畫，或先建立新的計畫。"
            action={<ButtonLink to="/coach/plans/new">建立計畫</ButtonLink>}
          />
        </Card>
      )}
    </div>
  )
}
