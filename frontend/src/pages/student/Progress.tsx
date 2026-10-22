import { ProgressDashboard } from '../../components/progress/ProgressDashboard'
import { Badge, BalanceMeter, Card, CardHeader, DemoNotice, PageHeader } from '../../components/ui/Primitives'
import { formatDate } from '../../lib/format'
import { LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { useData } from '../../store/contexts'
import { selectBalance, useCurrentStudent } from '../../store/selectors'

export function StudentProgressPage() {
  const { data } = useData()
  const student = useCurrentStudent()!
  const balance = selectBalance(data, student.id)

  return (
    <div>
      <PageHeader title="進步追蹤" description="所有數值都來自你實際完成的組數" />
      <ProgressDashboard studentId={student.id} audience="student" />

      <Card className="mt-4">
        <CardHeader title="教練課堂數" description="只有教練課會扣除堂數，自主訓練不會" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[200px_1fr]">
          <div>
            <p className={`num text-[32px] ${balance.remaining <= LOW_BALANCE_THRESHOLD ? 'text-warn-600' : 'text-ink-900'}`}>
              {balance.remaining}
              <span className="ml-1 text-base font-normal text-ink-500">堂</span>
            </p>
            <p className="mt-1 text-xs text-ink-500">
              累計購買 {balance.totalPurchased} 堂・已使用 {balance.used} 堂
            </p>
          </div>
          <ul className="space-y-3">
            {[...balance.packages].reverse().map((b) => (
              <li key={b.pkg.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-800">
                    {b.pkg.name}
                    {b.remaining === 0 && <Badge>已用完</Badge>}
                  </span>
                  <span className="tabular text-ink-600">
                    剩 {b.remaining} / {b.total + Math.max(0, b.adjusted)}
                  </span>
                </div>
                <BalanceMeter remaining={b.remaining} total={b.total + Math.max(0, b.adjusted)} />
                <p className="mt-1 text-xs text-ink-500">購買於 {formatDate(b.pkg.purchaseDate, { year: true })}</p>
              </li>
            ))}
            {!balance.packages.length && <li className="text-sm text-ink-500">尚無課程方案</li>}
          </ul>
        </div>
      </Card>
      <DemoNotice className="mt-6" />
    </div>
  )
}
