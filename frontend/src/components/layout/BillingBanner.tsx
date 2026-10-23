import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { daysLeft } from '../../lib/billing'
import { formatDate } from '../../lib/format'
import { useData } from '../../store/contexts'

/** Trial countdown, read-only notice and failed payments, above every coach page (except billing itself). */
export function BillingBanner() {
  const { data } = useData()
  const { pathname } = useLocation()
  const b = data.billing
  if (!b || pathname.startsWith('/coach/billing')) return null

  const days = daysLeft(b.trialEndsAt)
  const message =
    b.status === 'expired'
      ? b.canManage
        ? '方案已到期，目前為唯讀。資料都還在，訂閱後立即恢復。'
        : '工作室的方案已到期，目前為唯讀。請聯絡經營者。'
      : b.status === 'past_due'
        ? '上期月費扣款失敗，請重新綁定信用卡，以免轉為唯讀。'
        : b.status === 'canceled' && b.currentPeriodEnd
          ? `已取消訂閱，${formatDate(b.currentPeriodEnd)} 後轉為唯讀。`
          : b.status === 'trialing'
            ? `免費試用剩 ${days} 天`
            : null
  if (!message) return null
  const urgent = b.status === 'expired' || b.status === 'past_due' || (b.status === 'trialing' && days <= 3)
  const action = b.status === 'expired' || b.status === 'past_due' ? '前往訂閱' : '查看方案'

  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 text-sm ${urgent ? 'bg-warn-50 text-warn-600' : 'bg-accent-50 text-accent-700'}`}
      role={urgent ? 'alert' : undefined}
    >
      <span className="flex-1">{message}</span>
      {b.canManage && (
        <Link to="/coach/billing" className="inline-flex items-center gap-1 font-medium whitespace-nowrap hover:underline">
          {action}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  )
}
