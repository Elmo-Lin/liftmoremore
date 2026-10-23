import { ChevronRight, Search, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { StudentFormModal } from '../../components/coach/StudentFormModal'
import { Button } from '../../components/ui/Button'
import { inputClass, Segmented, ToolbarSelect } from '../../components/ui/Form'
import { Avatar, Badge, BalanceMeter, Card, EmptyState, PageHeader } from '../../components/ui/Primitives'
import { GOAL_LABEL, relativeDay } from '../../lib/format'
import { LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { workoutDate } from '../../lib/stats'
import { useData, useSession } from '../../store/contexts'
import { selectBalance, selectCoachName, selectCoachOf, selectCompleted, selectPlan } from '../../store/selectors'

type StatusFilter = 'all' | 'active' | 'inactive'
type SortKey = 'name' | 'balance' | 'recent'

export function StudentsPage() {
  const { data } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [sort, setSort] = useState<SortKey>('recent')
  const [coachFilter, setCoachFilter] = useState('all')
  const adding = params.get('new') === '1'
  // Studio owners see every coach's students: show who teaches whom and let them filter by coach.
  const { session } = useSession()
  const showCoach = session?.role === 'owner' && (data.studio?.coaches.length ?? 0) > 1

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const digits = term.replace(/\D/g, '')
    return data.students
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => coachFilter === 'all' || selectCoachOf(data, s.id) === coachFilter)
      .filter(
        (s) =>
          !term ||
          s.name.toLowerCase().includes(term) ||
          s.email.toLowerCase().includes(term) ||
          (digits.length >= 3 && (s.phone ?? '').replace(/\D/g, '').includes(digits)) ||
          GOAL_LABEL[s.goal].includes(term),
      )
      .map((s) => {
        const last = selectCompleted(data, s.id)[0]
        return { student: s, balance: selectBalance(data, s.id), last: last ? workoutDate(last) : undefined, plan: selectPlan(data, s.activePlanId) }
      })
      .sort((a, b) => {
        if (sort === 'name') return a.student.name.localeCompare(b.student.name, 'zh-Hant')
        if (sort === 'balance') return a.balance.remaining - b.balance.remaining
        return (b.last ?? '').localeCompare(a.last ?? '')
      })
  }, [data, q, status, sort, coachFilter])

  const counts = {
    all: data.students.length,
    active: data.students.filter((s) => s.status === 'active').length,
    inactive: data.students.filter((s) => s.status === 'inactive').length,
  }

  return (
    <div>
      <PageHeader
        title="學員"
        description={`${counts.active} 位進行中・${counts.inactive} 位暫停`}
        actions={
          <Button icon={UserPlus} onClick={() => setParams({ new: '1' })}>
            新增學員
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋姓名、Email、電話或目標"
            aria-label="搜尋學員"
            className={`${inputClass} h-10 pl-9`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="狀態篩選"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'active', label: `進行中 ${counts.active}` },
              { value: 'inactive', label: `暫停 ${counts.inactive}` },
              { value: 'all', label: '全部' },
            ]}
          />
          {showCoach && (
            <ToolbarSelect label="教練" value={coachFilter} onChange={(e) => setCoachFilter(e.target.value)}>
              <option value="all">所有教練</option>
              {data.studio!.coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.status === 'inactive' ? '（已停用）' : ''}
                </option>
              ))}
            </ToolbarSelect>
          )}
          <ToolbarSelect label="排序" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="recent">最近訓練</option>
            <option value="balance">剩餘堂數</option>
            <option value="name">姓名</option>
          </ToolbarSelect>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={q ? '找不到符合的學員' : status === 'inactive' ? '沒有暫停中的學員' : '還沒有學員'}
            description={q ? '換個關鍵字，或調整狀態篩選。' : '新增第一位學員，開始記錄訓練與堂數。'}
            action={
              !q && (
                <Button icon={UserPlus} onClick={() => setParams({ new: '1' })}>
                  新增學員
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-subtle/60 text-left text-xs text-ink-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">學員</th>
                  <th className="px-3 py-2.5 font-medium">訓練目標</th>
                  <th className="px-3 py-2.5 font-medium">計畫</th>
                  <th className="w-40 px-3 py-2.5 font-medium">剩餘堂數</th>
                  <th className="px-3 py-2.5 font-medium">上次訓練</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ student: s, balance, last, plan }) => (
                  <tr key={s.id} className="cursor-pointer hover:bg-subtle/50" onClick={() => navigate(`/coach/students/${s.id}`)}>
                    <td className="px-5 py-3">
                      <Link to={`/coach/students/${s.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Avatar name={s.name} id={s.id} size="sm" />
                        <span>
                          <span className="flex items-center gap-1.5 font-medium text-ink-900">
                            {s.name}
                            {s.status === 'inactive' && <Badge>暫停</Badge>}
                          </span>
                          <span className="text-xs text-ink-500">
                            {s.phone || s.email}
                            {showCoach && `・${selectCoachName(data, selectCoachOf(data, s.id))}`}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-ink-800">{GOAL_LABEL[s.goal]}</span>
                      <p className="max-w-56 truncate text-xs text-ink-500">{s.goalDetail}</p>
                    </td>
                    <td className="px-3 py-3 text-ink-600">{plan?.name ?? <span className="text-ink-400">未指派</span>}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-baseline gap-1">
                        <span className={`tabular font-semibold ${balance.remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : 'text-ink-900'}`}>{balance.remaining}</span>
                        <span className="text-xs text-ink-500">堂</span>
                      </div>
                      <div className="mt-1 w-28">
                        <BalanceMeter remaining={balance.remaining} total={balance.packages.at(-1)?.total ?? 0} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-600">{last ? relativeDay(last) : <span className="text-ink-400">尚無</span>}</td>
                    <td className="pr-4">
                      <ChevronRight className="size-4 text-ink-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {rows.map(({ student: s, balance, last }) => (
              <Link key={s.id} to={`/coach/students/${s.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-subtle">
                <Avatar name={s.name} id={s.id} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium text-ink-900">
                    {s.name}
                    {s.status === 'inactive' && <Badge>暫停</Badge>}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {showCoach && `${selectCoachName(data, selectCoachOf(data, s.id))}・`}
                    {GOAL_LABEL[s.goal]}・上次 {last ? relativeDay(last) : '尚無'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`tabular text-lg leading-none font-semibold ${balance.remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : 'text-ink-900'}`}>
                    {balance.remaining}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">剩餘堂數</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <StudentFormModal
        open={adding}
        onClose={() => setParams({}, { replace: true })}
        onSaved={(s) => navigate(`/coach/students/${s.id}`)}
      />
    </div>
  )
}
