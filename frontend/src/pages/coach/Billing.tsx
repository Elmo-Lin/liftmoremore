import { Check, CreditCard, Minus, Plus, Receipt } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { refreshSession } from '../../api/auth'
import { cancelSubscription, changePlan, fetchBilling, goToCheckout, subscribe, type Payment } from '../../api/billing'
import { isApiMode } from '../../api/client'
import { Button, IconButton } from '../../components/ui/Button'
import { Segmented, TextInput } from '../../components/ui/Form'
import { ConfirmDialog } from '../../components/ui/Modal'
import { PageLoading } from '../../components/ui/PageLoading'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '../../components/ui/Primitives'
import {
  coachLimit,
  COACH_SEAT_PRICE,
  daysLeft,
  MAX_COACH_SEATS,
  MAX_STUDENT_PACKS,
  monthlyPrice,
  PLANS,
  prorate,
  STATUS_LABEL,
  STUDENT_PACK,
  studentLimit,
} from '../../lib/billing'
import { formatDate, formatDateTime, twd } from '../../lib/format'
import { seatsUsed } from '../../store/actions'
import { useData, useSession, useToast } from '../../store/contexts'
import type { Billing, PlanId } from '../../types'

const PAYMENT_LABEL: Record<Payment['kind'], string> = { subscription: '首期月費', renewal: '月費', proration: '加購（本期按比例）' }

const RULES = [
  '活躍學員才佔名額：已結案、停用的學員不計費，歷史資料仍保留。',
  '教練名額按帳號計算：邀請一位教練就佔一個名額；停用或移除後釋出。',
  '超過名額不會刪除資料，只會暫停新增學員或教練。',
  '加購立即生效，本期按剩餘天數比例收費；減少名額於下個計費週期生效。',
  '同一位學員在同一工作室只算一次，不會因為兩位教練共同管理而重複計費。',
]

export function BillingPage() {
  const { data, status, reload } = useData()
  const { session, signIn } = useSession()
  const notify = useToast()
  const [params, setParams] = useSearchParams()
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const handled = useRef(false)
  const token = session?.token

  // Back from NewebPay. A paid upgrade to Team changes the role, so take a fresh token (which also reloads the data).
  useEffect(() => {
    const result = params.get('result')
    if (!result || !token || handled.current) return
    handled.current = true
    setParams({}, { replace: true })
    if (result === 'success') {
      notify('付款完成，方案已更新')
      refreshSession(token).then(signIn, () => void reload())
    } else {
      notify('付款未完成，方案沒有變更', 'error')
    }
  }, [params, setParams, token, notify, signIn, reload])

  useEffect(() => {
    if (!token || !data.billing?.canManage) return
    let cancelled = false
    fetchBilling(token).then(
      (r) => !cancelled && setPayments(r.payments),
      () => !cancelled && setPayments([]),
    )
    return () => {
      cancelled = true
    }
  }, [token, data.billing?.canManage, data.billing?.currentPeriodEnd, data.billing?.monthlyAmount])

  if (!isApiMode) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="方案與付款" />
        <Card>
          <EmptyState icon={CreditCard} title="示範版不需付款" description="正式帳號的教練可免費試用 10 天，之後依方案按月付費。" />
        </Card>
      </div>
    )
  }
  const billing = data.billing
  if (!billing) return status === 'loading' ? <PageLoading /> : null

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="方案與付款" description={PLANS[billing.plan].name} />
      <div className="space-y-4">
        <StatusCard billing={billing} coachesUsed={seatsUsed(data)} />
        {billing.canManage ? (
          <>
            <PlanEditor billing={billing} />
            <PaymentHistory payments={payments} />
            {billing.subscribed && billing.status !== 'canceled' && billing.status !== 'expired' && <CancelSubscription billing={billing} />}
          </>
        ) : (
          <Card className="p-5 text-sm text-ink-600">方案與付款由工作室經營者管理。需要更多學員或教練名額時，請聯絡經營者。</Card>
        )}
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-900">計費方式</p>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-600">
            {RULES.map((r) => (
              <li key={r} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent-600" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------- status

function StatusCard({ billing: b, coachesUsed }: { billing: Billing; coachesUsed: number }) {
  const tone = b.status === 'expired' || b.status === 'past_due' ? 'warn' : b.status === 'trialing' ? 'accent' : 'neutral'
  const detail = {
    trialing: `免費試用至 ${formatDate(b.trialEndsAt, { year: true })}（剩 ${daysLeft(b.trialEndsAt)} 天），不需信用卡。試用結束若未訂閱，資料會保留但轉為唯讀。`,
    active: b.currentPeriodEnd ? `下次扣款日 ${formatDate(b.currentPeriodEnd, { year: true })}。` : '',
    past_due: '上期月費扣款失敗。請重新綁定信用卡訂閱，以免轉為唯讀。',
    canceled: b.currentPeriodEnd ? `已取消訂閱，可使用至 ${formatDate(b.currentPeriodEnd, { year: true })}，之後轉為唯讀。` : '已取消訂閱。',
    expired: '方案已到期，目前為唯讀。資料都還在，訂閱後立即恢復新增與編輯。',
  }[b.status]
  const pending = b.nextExtraStudentPacks != null || b.nextExtraCoachSeats != null

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={tone}>{STATUS_LABEL[b.status]}</Badge>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {twd(b.monthlyAmount)}
            <span className="ml-1 text-sm font-normal text-ink-500">/ 月</span>
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-600">{detail}</p>
      {pending && (
        <p className="mt-2 text-[13px] text-ink-500">
          下期起：
          {b.nextExtraStudentPacks != null && `加購學員 ${b.nextExtraStudentPacks} 組`}
          {b.nextExtraStudentPacks != null && b.nextExtraCoachSeats != null && '、'}
          {b.nextExtraCoachSeats != null && `加購教練 ${b.nextExtraCoachSeats} 位`}
        </p>
      )}
      <div className={`mt-4 grid gap-4 ${b.plan === 'team' ? 'sm:grid-cols-2' : ''}`}>
        <Usage label="活躍學員" used={b.activeStudents} limit={b.studentLimit} />
        {b.plan === 'team' && <Usage label="教練（含經營者）" used={coachesUsed} limit={b.coachLimit} />}
      </div>
    </Card>
  )
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const full = used >= limit
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-ink-600">{label}</span>
        <span className={`tabular font-medium ${full ? 'text-warn-600' : 'text-ink-900'}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
        <div className={`h-full rounded-full ${full ? 'bg-warn-500' : 'bg-accent-600'}`} style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} />
      </div>
      {full && <p className="mt-1 text-xs text-warn-600">已達上限，暫停新增。</p>}
    </div>
  )
}

// ----------------------------------------------------------------------------- plan editor

function PlanEditor({ billing: b }: { billing: Billing }) {
  const { data, reload } = useData()
  const { session, signIn } = useSession()
  const notify = useToast()
  const [plan, setPlan] = useState<PlanId>(b.plan)
  const [packs, setPacks] = useState(b.nextExtraStudentPacks ?? b.extraStudentPacks)
  const [seats, setSeats] = useState(b.nextExtraCoachSeats ?? b.extraCoachSeats)
  const [studioName, setStudioName] = useState(data.coach.studio)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const paying = b.subscribed && (b.status === 'active' || b.status === 'past_due')
  // A lapsed or canceled plan must subscribe again before changing; Team → Pro is not self-serve.
  const canChoosePlan = b.plan === 'pro' && (b.status === 'trialing' || b.status === 'active')
  const upgrading = plan !== b.plan
  const changed = upgrading || packs !== (b.nextExtraStudentPacks ?? b.extraStudentPacks) || (plan === 'team' && seats !== (b.nextExtraCoachSeats ?? b.extraCoachSeats))
  const monthly = monthlyPrice(plan, packs, seats)
  const currentMonthly = monthlyPrice(b.plan, b.extraStudentPacks, b.extraCoachSeats)
  const charge = paying ? prorate(monthlyPrice(plan, Math.max(packs, b.extraStudentPacks), Math.max(seats, b.extraCoachSeats)) - currentMonthly, b.currentPeriodEnd) : 0
  const needsSubscribe = !paying || b.status === 'past_due'
  const input = { plan, extraStudentPacks: packs, extraCoachSeats: plan === 'team' ? seats : 0, studioName: upgrading ? studioName.trim() : undefined }

  const run = async (task: (token: string) => Promise<void>) => {
    if (!session?.token) return
    if (upgrading && !studioName.trim()) return notify('請輸入工作室名稱', 'error')
    setBusy(true)
    try {
      await task(session.token)
    } catch (e) {
      notify(e instanceof Error ? e.message : '操作失敗', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Applied without payment: refresh the token if the role changed (Pro → Team), else just reload. */
  const afterApplied = async (token: string, message: string) => {
    notify(message)
    if (upgrading) signIn(await refreshSession(token))
    else await reload()
  }

  const startSubscription = () =>
    run(async (token) => {
      if (upgrading) await changePlan(input, token) // free during the trial
      goToCheckout(await subscribe({ extraStudentPacks: input.extraStudentPacks, extraCoachSeats: input.extraCoachSeats }, token))
    })

  const applyInTrial = () =>
    run(async (token) => {
      await changePlan(input, token)
      await afterApplied(token, '已套用，試用期間免費')
    })

  const applyChange = () =>
    run(async (token) => {
      setConfirming(false)
      const r = await changePlan(input, token)
      if (r.checkout) return goToCheckout(r.checkout)
      await afterApplied(token, '已更新，將於下期生效')
    })

  return (
    <Card>
      <CardHeader
        title={paying && b.status === 'active' ? '調整方案' : b.status === 'trialing' ? '選擇方案' : '訂閱'}
        description={paying && b.status === 'active' ? '加購立即生效（本期按比例收費）；減少名額下期生效' : `${PLANS[plan].name}・每月 ${twd(PLANS[plan].price)} 起`}
      />
      <div className="space-y-5 border-t border-line p-5">
        {canChoosePlan && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-700">方案</p>
            <Segmented
              label="方案"
              value={plan}
              onChange={setPlan}
              options={[
                { value: 'pro', label: `自由教練 Pro・${twd(PLANS.pro.price)}` },
                { value: 'team', label: `工作室 Team・${twd(PLANS.team.price)}` },
              ]}
            />
            <p className="mt-1.5 text-xs text-ink-500">
              {plan === 'pro' ? `含 ${PLANS.pro.students} 位活躍學員。` : `含 ${PLANS.team.coaches} 位教練（含你）、${PLANS.team.students} 位活躍學員，可邀請教練加入。`}
            </p>
          </div>
        )}
        {upgrading && <TextInput label="工作室名稱" required maxLength={120} value={studioName} onChange={(e) => setStudioName(e.target.value)} />}
        <Stepper
          label="加購學員名額"
          hint={`每 ${STUDENT_PACK.size} 位 ${twd(STUDENT_PACK.price)}/月`}
          value={packs}
          max={MAX_STUDENT_PACKS}
          unit="組"
          onChange={setPacks}
        />
        {plan === 'team' && (
          <Stepper label="加購教練名額" hint={`每位 ${twd(COACH_SEAT_PRICE)}/月`} value={seats} max={MAX_COACH_SEATS} unit="位" onChange={setSeats} />
        )}
        <div className="rounded-lg bg-canvas px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-600">
              學員上限 {studentLimit(plan, packs)} 位{plan === 'team' ? `・教練 ${coachLimit(plan, seats)} 位` : ''}
            </span>
            <span className="font-semibold text-ink-900">{twd(monthly)} / 月</span>
          </div>
          {paying && changed && charge > 0 && <p className="mt-1 text-[13px] text-ink-500">本期需補 {twd(charge)}（按剩餘天數比例），付款後立即生效。</p>}
        </div>

        {!b.paymentsEnabled && <p className="text-[13px] text-warn-600">線上付款即將開放，目前還無法訂閱或加購。</p>}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          {needsSubscribe ? (
            <Button icon={CreditCard} className="h-11 md:h-10" disabled={busy || !b.paymentsEnabled} onClick={() => void startSubscription()}>
              {busy ? '處理中…' : b.status === 'past_due' ? `重新綁卡訂閱・${twd(monthly)}/月` : `訂閱・${twd(monthly)}/月`}
            </Button>
          ) : (
            <Button className="h-11 md:h-10" disabled={busy || !changed || (charge > 0 && !b.paymentsEnabled)} onClick={() => setConfirming(true)}>
              {busy ? '處理中…' : charge > 0 ? `付款並升級・${twd(charge)}` : '確認變更'}
            </Button>
          )}
          {b.status === 'trialing' && changed && (
            <Button variant="secondary" className="h-11 md:h-10" disabled={busy} onClick={() => void applyInTrial()}>
              試用期間先套用
            </Button>
          )}
        </div>
        {needsSubscribe && (
          <p className="text-xs leading-relaxed text-ink-500">
            將前往藍新金流輸入信用卡。訂閱後立即扣第一個月，之後每月同一天自動扣款，可隨時取消。
            {b.status === 'trialing' && '剩餘的試用天數不會保留。'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={charge > 0 ? `本期補 ${twd(charge)}，立即生效` : '下期起生效'}
        description={
          charge > 0
            ? `將前往藍新金流付款。付款完成後立即開通，下期起每月 ${twd(monthly)}。`
            : `目前的名額會保留到本期結束，下期起每月 ${twd(monthly)}。超過新名額的學員與教練不會被刪除，只是暫停新增。`
        }
        confirmLabel={charge > 0 ? '前往付款' : '確認'}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void applyChange()}
      />
    </Card>
  )
}

function Stepper({ label, hint, value, max, unit, onChange }: { label: string; hint: string; value: number; max: number; unit: string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[13px] font-medium text-ink-700">{label}</p>
        <p className="text-xs text-ink-500">{hint}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <IconButton icon={Minus} label={`減少${label}`} className="border border-line" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} />
        <span className="tabular w-14 text-center text-base font-semibold text-ink-900">
          {value} <span className="text-xs font-normal text-ink-500">{unit}</span>
        </span>
        <IconButton icon={Plus} label={`增加${label}`} className="border border-line" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------- history & cancel

function PaymentHistory({ payments }: { payments: Payment[] | null }) {
  return (
    <Card>
      <CardHeader title="付款紀錄" />
      {payments === null ? (
        <p className="border-t border-line px-5 py-4 text-sm text-ink-500">載入中…</p>
      ) : payments.length === 0 ? (
        <EmptyState compact icon={Receipt} title="尚無付款紀錄" />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="tabular w-36 shrink-0 text-ink-500">{formatDateTime(p.createdAt)}</span>
              <span className="flex-1 text-ink-800">{PAYMENT_LABEL[p.kind]}</span>
              {p.status === 'failed' && <Badge tone="warn">扣款失敗</Badge>}
              <span className="tabular font-medium text-ink-900">{twd(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function CancelSubscription({ billing: b }: { billing: Billing }) {
  const { reload } = useData()
  const { session } = useSession()
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const until = b.currentPeriodEnd ? formatDate(b.currentPeriodEnd, { year: true }) : '本期結束'

  return (
    <div className="px-1 text-center">
      <button type="button" className="text-[13px] text-ink-500 underline-offset-2 hover:text-danger-600 hover:underline" onClick={() => setOpen(true)}>
        取消訂閱
      </button>
      <ConfirmDialog
        open={open}
        title="取消訂閱？"
        description={`不會再自動扣款。你可以繼續使用到 ${until}，之後轉為唯讀；資料都會保留，隨時可以重新訂閱。`}
        confirmLabel="取消訂閱"
        tone="danger"
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setOpen(false)
          if (!session?.token) return
          try {
            await cancelSubscription(session.token)
            notify(`已取消訂閱，可使用至 ${until}`)
            await reload()
          } catch (e) {
            notify(e instanceof Error ? e.message : '取消失敗', 'error')
          }
        }}
      />
    </div>
  )
}
