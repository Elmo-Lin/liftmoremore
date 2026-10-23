import { ChartLine, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDate, volumeNumber } from '../../lib/format'
import {
  consistency,
  exerciseSeries,
  personalRecords,
  weeklyBuckets,
  workoutDate,
  workoutVolume,
} from '../../lib/stats'
import { useData } from '../../store/contexts'
import { selectCompleted, selectStudent, useExerciseMap, useIsSelf } from '../../store/selectors'
import type { ID } from '../../types'
import { Segmented, ToolbarSelect } from '../ui/Form'
import { Card, CardHeader, EmptyState, Stat } from '../ui/Primitives'
import { SERIES_1, SERIES_2 } from './chartColors'
import { BodyweightChart, ExerciseProgressChart, FrequencyChart, Legend, WeeklyVolumeChart } from './Charts'
import { PRTable } from './PRTable'

type RangeKey = '4' | '8' | '12' | 'all'
const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '4', label: '4 週' },
  { value: '8', label: '8 週' },
  { value: '12', label: '12 週' },
  { value: 'all', label: '全部' },
]

const PREFERRED = ['ex_squat', 'ex_bench', 'ex_deadlift', 'ex_hipthrust', 'ex_goblet', 'ex_legpress']

export function ProgressDashboard({ studentId, audience }: { studentId: ID; audience: 'coach' | 'student' }) {
  const isSelf = useIsSelf()
  const { data } = useData()
  const exMap = useExerciseMap()
  const student = selectStudent(data, studentId)
  const [range, setRange] = useState<RangeKey>('12')
  const [exerciseId, setExerciseId] = useState<ID>('')
  const [showE1RM, setShowE1RM] = useState(false)
  const [tableView, setTableView] = useState(false)
  const [now] = useState(() => Date.now())

  const all = useMemo(() => selectCompleted(data, studentId), [data, studentId])

  const weeks = useMemo(() => {
    if (range !== 'all') return Number(range)
    const earliest = all[all.length - 1]
    if (!earliest) return 4
    return Math.max(4, Math.ceil((now - new Date(workoutDate(earliest)).getTime()) / (7 * 86400000)) + 1)
  }, [range, all, now])

  const since = useMemo(() => new Date(now - weeks * 7 * 86400000).toISOString(), [now, weeks])

  const inRange = useMemo(() => all.filter((w) => workoutDate(w) >= since), [all, since])

  const exerciseOptions = useMemo(() => {
    const counts = new Map<ID, number>()
    for (const w of all) for (const e of w.exercises) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [all])

  const activeExercise =
    exerciseId && exerciseOptions.includes(exerciseId)
      ? exerciseId
      : (PREFERRED.find((id) => exerciseOptions.includes(id)) ?? exerciseOptions[0] ?? '')

  const series = useMemo(() => (activeExercise ? exerciseSeries(inRange, activeExercise) : []), [inRange, activeExercise])
  const buckets = useMemo(() => weeklyBuckets(inRange, Math.min(weeks, 26)), [inRange, weeks])
  const prs = useMemo(() => personalRecords(all), [all])
  const bodyweight = useMemo(
    () =>
      data.metrics
        .filter((m) => m.studentId === studentId && m.type === 'bodyweight' && m.recordedAt >= since)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
        .map((m) => ({ date: m.recordedAt, value: m.value })),
    [data.metrics, studentId, since],
  )

  if (!all.length) {
    return (
      <Card>
        <EmptyState
          icon={ChartLine}
          title="還沒有完成的訓練"
          description={audience === 'coach' ? '完成第一次訓練後，這裡會顯示重量、訓練量與頻率的變化。' : '完成第一次訓練後，就能在這裡看到自己的進步。'}
        />
      </Card>
    )
  }

  const totalVolume = inRange.reduce((s, w) => s + workoutVolume(w), 0)
  const coachedCount = inRange.filter((w) => w.type === 'coached').length
  const target = student?.weeklyFrequency ?? 2
  const consistencyPct = Math.round(consistency(buckets, target) * 100)
  const first = series[0]
  const latest = series[series.length - 1]
  const change = first && latest ? latest.topWeight - first.topWeight : 0
  const exName = exMap.get(activeExercise)?.name ?? ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="時間範圍" value={range} onChange={setRange} options={RANGE_OPTIONS} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="訓練次數" value={inRange.length} unit="次" sub={isSelf ? undefined : `教練課 ${coachedCount}・自主 ${inRange.length - coachedCount}`} />
        <Stat label="總訓練量" value={volumeNumber(totalVolume)} unit="kg" sub="重量 × 次數，僅計入完成組" />
        <Stat label="平均每週" value={(inRange.length / Math.max(1, buckets.length)).toFixed(1)} unit="次" sub={`目標每週 ${target} 次`} />
        <Stat label="訓練一致性" value={`${consistencyPct}%`} sub={`達到每週 ${target} 次的週數比例`} />
      </div>

      <Card>
        <CardHeader
          title="動作進步"
          description={`每次訓練中實際完成的最重一組（kg）`}
          action={
            <ToolbarSelect label="選擇動作" value={activeExercise} onChange={(e) => setExerciseId(e.target.value)}>
              {exerciseOptions.map((id) => (
                <option key={id} value={id}>
                  {exMap.get(id)?.name}
                </option>
              ))}
            </ToolbarSelect>
          }
        />
        <div className="px-5 pb-4">
          {series.length ? (
            <>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-500">{exName}・最近一次最重組</p>
                  <p className="mt-0.5 text-2xl font-semibold text-ink-900">
                    {latest.topWeight} kg <span className="text-base font-normal text-ink-500">× {latest.topReps}</span>
                  </p>
                  {series.length > 1 && (
                    <p className={`mt-0.5 text-xs ${change > 0 ? 'text-accent-700' : 'text-ink-500'}`}>
                      {change > 0 ? '+' : ''}
                      {change} kg（與範圍內第一次相比，{formatDate(first.date)} 起）
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-600 select-none">
                    <input type="checkbox" checked={showE1RM} onChange={(e) => setShowE1RM(e.target.checked)} className="size-4 accent-[#0071e3]" />
                    顯示估算 1RM
                  </label>
                  <button
                    type="button"
                    onClick={() => setTableView((v) => !v)}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-600 hover:bg-subtle"
                    aria-pressed={tableView}
                  >
                    {tableView ? <ChartLine className="size-3.5" /> : <Table2 className="size-3.5" />}
                    {tableView ? '圖表' : '表格'}
                  </button>
                </div>
              </div>
              {showE1RM && (
                <div className="mb-2">
                  <Legend
                    items={[
                      { color: SERIES_1, label: '最重組（實際重量）' },
                      { color: SERIES_2, label: '估算 1RM（Epley 公式，僅 ≤10 下的組）' },
                    ]}
                  />
                </div>
              )}
              {tableView ? (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-subtle text-left text-xs text-ink-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">日期</th>
                        <th className="px-3 py-2 text-right font-medium">最重組</th>
                        <th className="px-3 py-2 text-right font-medium">估算 1RM</th>
                        <th className="px-3 py-2 text-right font-medium">訓練量</th>
                      </tr>
                    </thead>
                    <tbody className="tabular divide-y divide-line">
                      {[...series].reverse().map((p) => (
                        <tr key={p.workoutId}>
                          <td className="px-3 py-2 text-ink-700">{formatDate(p.date, { year: true })}</td>
                          <td className="px-3 py-2 text-right text-ink-900">
                            {p.topWeight} kg × {p.topReps}
                          </td>
                          <td className="px-3 py-2 text-right text-ink-500">{p.e1rm != null ? `${p.e1rm} kg` : '—'}</td>
                          <td className="px-3 py-2 text-right text-ink-700">{Math.round(p.volume).toLocaleString('zh-TW')} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ExerciseProgressChart points={series} showE1RM={showE1RM} />
              )}
            </>
          ) : (
            <EmptyState compact icon={ChartLine} title="此範圍內沒有這個動作的紀錄" description="試試拉長時間範圍或選擇其他動作。" />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="每週訓練量" description="所有動作的重量 × 次數總和（kg）" />
          <div className="px-3 pb-4">
            <WeeklyVolumeChart buckets={buckets} />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="訓練頻率"
            description="每週完成的訓練次數"
            action={
              !isSelf && (
                <Legend
                  items={[
                    { color: SERIES_1, label: '教練課' },
                    { color: SERIES_2, label: '自主訓練' },
                  ]}
                />
              )
            }
          />
          <div className="px-3 pb-4">
            <FrequencyChart buckets={buckets} byType={!isSelf} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="個人紀錄" description="全部歷史中實際完成的最重一組；估算 1RM 僅供參考" />
          <PRTable prs={prs.slice(0, 8)} />
        </Card>
        {bodyweight.length > 1 && (
          <Card>
            <CardHeader title="體重紀錄" description="每週量測（kg）" />
            <div className="px-3 pb-4">
              <BodyweightChart points={bodyweight} />
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
