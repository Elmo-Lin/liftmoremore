import { ChartLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ProgressDashboard } from '../../components/progress/ProgressDashboard'
import { ToolbarSelect } from '../../components/ui/Form'
import { Avatar, Card, CardHeader, DemoNotice, EmptyState, PageHeader } from '../../components/ui/Primitives'
import { relativeDay } from '../../lib/format'
import { deductionFor, LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { weeklyBuckets, workoutDate } from '../../lib/stats'
import { useData } from '../../store/contexts'
import { selectBalance, selectCompleted } from '../../store/selectors'
import type { ID } from '../../types'

export function CoachAnalyticsPage() {
  const { data } = useData()
  const [params, setParams] = useSearchParams()
  const students = useMemo(
    () => [...data.students].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name, 'zh-Hant') : a.status === 'active' ? -1 : 1)),
    [data.students],
  )
  const fromUrl = params.get('student')
  const [picked, setPicked] = useState<ID>(fromUrl ?? '')
  const studentId = students.some((s) => s.id === picked) ? picked : (students[0]?.id ?? '')

  return (
    <div>
      <PageHeader
        title="數據分析"
        description="以一致的指標比較學員的重量、訓練量與頻率"
        actions={
          students.length > 0 && (
            <ToolbarSelect
              label="選擇學員"
              value={studentId}
              onChange={(e) => {
                setPicked(e.target.value)
                setParams({ student: e.target.value }, { replace: true })
              }}
              className="h-10 min-w-40"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.status === 'inactive' ? '（暫停）' : ''}
                </option>
              ))}
            </ToolbarSelect>
          )
        }
      />
      <DemoNotice className="mb-4" />

      {!studentId ? (
        <Card>
          <EmptyState icon={ChartLine} title="尚無學員資料" />
        </Card>
      ) : (
        <div className="space-y-4">
          <ProgressDashboard key={studentId} studentId={studentId} audience="coach" />
          <SessionCompletion studentId={studentId} />
          <Roster />
        </div>
      )}
    </div>
  )
}

/** Monthly coached sessions vs. deductions for one student. */
function SessionCompletion({ studentId }: { studentId: ID }) {
  const { data } = useData()
  const rows = useMemo(() => {
    const months = new Map<string, { key: string; label: string; coached: number; deducted: number; independent: number }>()
    for (const w of selectCompleted(data, studentId)) {
      const d = new Date(workoutDate(w))
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const row = months.get(key) ?? { key, label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`, coached: 0, deducted: 0, independent: 0 }
      if (w.type === 'coached') {
        row.coached++
        if (deductionFor(w.id, data.transactions)) row.deducted++
      } else row.independent++
      months.set(key, row)
    }
    return [...months.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [data, studentId])
  const balance = selectBalance(data, studentId)

  return (
    <Card>
      <CardHeader title="課程完成紀錄" description={`每月完成的教練課與扣堂狀況・目前剩餘 ${balance.remaining} 堂`} />
      {rows.length ? (
        <div className="overflow-x-auto border-t border-line">
          <table className="tabular w-full min-w-[480px] text-sm">
            <thead className="bg-subtle/60 text-left text-xs text-ink-500">
              <tr>
                <th className="px-5 py-2 font-medium">月份</th>
                <th className="px-3 py-2 text-right font-medium">完成教練課</th>
                <th className="px-3 py-2 text-right font-medium">已扣堂</th>
                <th className="px-3 py-2 text-right font-medium">未扣堂</th>
                <th className="px-5 py-2 text-right font-medium">自主訓練</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-5 py-2.5 text-ink-800">{r.label}</td>
                  <td className="px-3 py-2.5 text-right text-ink-900">{r.coached}</td>
                  <td className="px-3 py-2.5 text-right text-ink-700">{r.deducted}</td>
                  <td className={`px-3 py-2.5 text-right ${r.coached - r.deducted > 0 ? 'font-medium text-warn-600' : 'text-ink-400'}`}>{r.coached - r.deducted}</td>
                  <td className="px-5 py-2.5 text-right text-ink-700">{r.independent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState compact icon={ChartLine} title="尚無完成的課程" />
      )}
    </Card>
  )
}

function Roster() {
  const { data } = useData()
  const rows = data.students
    .filter((s) => s.status === 'active')
    .map((s) => {
      const ws = selectCompleted(data, s.id)
      const b = weeklyBuckets(ws, 4)
      const perWeek = b.reduce((n, x) => n + x.coached + x.independent, 0) / 4
      return { s, perWeek, last: ws[0] ? workoutDate(ws[0]) : undefined, remaining: selectBalance(data, s.id).remaining }
    })
    .sort((a, b) => b.perWeek - a.perWeek)
  return (
    <Card>
      <CardHeader title="學員總覽" description="近 4 週平均訓練頻率（含自主訓練）與計畫頻率比較" />
      <div className="overflow-x-auto border-t border-line">
        <table className="tabular w-full min-w-[520px] text-sm">
          <thead className="bg-subtle/60 text-left text-xs text-ink-500">
            <tr>
              <th className="px-5 py-2 font-medium">學員</th>
              <th className="px-3 py-2 text-right font-medium">近 4 週每週</th>
              <th className="px-3 py-2 text-right font-medium">計畫</th>
              <th className="px-3 py-2 text-right font-medium">上次訓練</th>
              <th className="px-5 py-2 text-right font-medium">剩餘堂數</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ s, perWeek, last, remaining }) => (
              <tr key={s.id}>
                <td className="px-5 py-2.5">
                  <Link to={`/coach/students/${s.id}?tab=progress`} className="flex items-center gap-2 font-medium text-ink-900 hover:underline">
                    <Avatar name={s.name} id={s.id} size="sm" />
                    {s.name}
                  </Link>
                </td>
                <td className={`px-3 py-2.5 text-right ${perWeek < s.weeklyFrequency * 0.75 ? 'text-warn-600' : 'text-ink-900'}`}>{perWeek.toFixed(1)} 次</td>
                <td className="px-3 py-2.5 text-right text-ink-500">{s.weeklyFrequency} 次</td>
                <td className="px-3 py-2.5 text-right text-ink-600">{last ? relativeDay(last) : '—'}</td>
                <td className={`px-5 py-2.5 text-right font-medium ${remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : 'text-ink-900'}`}>{remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
