import { Trophy } from 'lucide-react'
import { formatDate } from '../../lib/format'
import type { PersonalRecord } from '../../lib/stats'
import { useExerciseMap } from '../../store/selectors'
import { EmptyState } from '../ui/Primitives'

export function PRTable({ prs }: { prs: PersonalRecord[] }) {
  const exMap = useExerciseMap()
  if (!prs.length) return <EmptyState compact icon={Trophy} title="尚無個人紀錄" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="border-y border-line bg-subtle/60 text-left text-xs text-ink-500">
          <tr>
            <th className="px-5 py-2 font-medium">動作</th>
            <th className="px-3 py-2 text-right font-medium">最重組（實際）</th>
            <th className="px-3 py-2 text-right font-medium">估算 1RM</th>
            <th className="px-5 py-2 text-right font-medium">日期</th>
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-line">
          {prs.map((pr) => (
            <tr key={pr.exerciseId}>
              <td className="px-5 py-2.5 font-medium text-ink-900">{exMap.get(pr.exerciseId)?.name}</td>
              <td className="px-3 py-2.5 text-right text-ink-900">
                {pr.maxWeight} kg × {pr.maxWeightReps}
              </td>
              <td className="px-3 py-2.5 text-right text-ink-500">{pr.bestE1RM != null ? `${pr.bestE1RM} kg` : '—'}</td>
              <td className="px-5 py-2.5 text-right text-ink-500">{formatDate(pr.maxWeightDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
