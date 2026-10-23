import { Building2, Check, Copy, KeyRound, Ticket, UserMinus, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { isApiMode } from '../../api/client'
import { inviteCoach, reinviteCoach, upgradeToStudio, type CoachInvite } from '../../api/studio'
import { Button } from '../../components/ui/Button'
import { SelectInput, TextInput } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { PageLoading } from '../../components/ui/PageLoading'
import { Avatar, Badge, Card, CardHeader, DemoNotice, PageHeader, Stat } from '../../components/ui/Primitives'
import { BRAND } from '../../config/brand'
import { formatDate } from '../../lib/format'
import { LOW_BALANCE_THRESHOLD } from '../../lib/sessions'
import { coachStats } from '../../lib/studio'
import { seatsOf, seatsUsed } from '../../store/actions'
import { useData, useSession, useToast } from '../../store/contexts'
import { selectActiveCoaches, selectIsStudio } from '../../store/selectors'
import type { AppData, CoachMember } from '../../types'

/** Owners manage their studio here; a free coach sees the upgrade offer; studio coaches never come here. */
export function StudioPage() {
  const { data } = useData()
  const { session } = useSession()
  if (session?.role === 'owner') {
    if (selectIsStudio(data)) return <ManageStudio />
    // The server always sends an owner their studio: right after upgrading, the new owner session
    // simply arrives before the reloaded data. Offline there is nothing to wait for.
    if (isApiMode) return <PageLoading />
  }
  if (session?.role === 'coach' && !selectIsStudio(data)) return <UpgradeToStudio />
  return <Navigate to="/coach" replace />
}

// ----------------------------------------------------------------------------- upgrade

function UpgradeToStudio() {
  const { data } = useData()
  const { session, signIn } = useSession()
  const notify = useToast()
  const [name, setName] = useState(data.coach.studio)
  const [busy, setBusy] = useState(false)

  const upgrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return notify('請輸入工作室名稱', 'error')
    if (!session?.token) return
    setBusy(true)
    try {
      signIn(await upgradeToStudio(name.trim(), session.token))
      notify('已升級為工作室，現在可以邀請教練加入')
    } catch (err) {
      notify(err instanceof Error ? err.message : '升級失敗', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="升級為工作室" description="和其他教練一起使用，學員與紀錄都集中在工作室。" />
      <Card className="p-5">
        <ul className="space-y-2.5 text-sm text-ink-700">
          {[
            '邀請最多 2 位教練加入（含你共 3 位），每位教練的功能和你現在一樣',
            '你可以看到所有教練的學員、課表與訓練紀錄',
            '學員屬於工作室：教練離開時可以把學員轉給其他教練，紀錄與堂數都保留',
            '訓練計畫在工作室內共用',
            '你現在的學員、課表與紀錄都會保留，不需要搬移',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-accent-600" />
              {t}
            </li>
          ))}
        </ul>
        <form onSubmit={upgrade} className="mt-5 space-y-3 border-t border-line pt-5">
          <TextInput label="工作室名稱" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" icon={Building2} className="h-11 w-full md:h-10" disabled={busy || !isApiMode}>
            {busy ? '處理中…' : '升級為工作室'}
          </Button>
          {!isApiMode && <p className="text-center text-xs text-ink-500">示範模式無法升級。可從「切換示範身分」改看「經營者」，體驗工作室的功能。</p>}
        </form>
      </Card>
    </div>
  )
}

// ----------------------------------------------------------------------------- manage

function ManageStudio() {
  const { data } = useData()
  const studio = data.studio!
  const [inviting, setInviting] = useState(false)
  const [shown, setShown] = useState<{ coach: CoachMember; code: string; expiresAt?: string } | null>(null)
  const [deactivating, setDeactivating] = useState<CoachMember | null>(null)

  const seats = seatsOf(data)
  const used = seatsUsed(data)
  const active = selectActiveCoaches(data)
  const statsFor = (coachId: string) => coachStats(data, coachId)
  const totals = active.map((c) => statsFor(c.id)).reduce((a, b) => ({ students: a.students + b.students, sessions: a.sessions + b.sessions, low: a.low + b.low }), { students: 0, sessions: 0, low: 0 })

  return (
    <div>
      <PageHeader
        title={studio.name || '工作室'}
        description={`教練名額 ${used} / ${seats}（含經營者）`}
        actions={
          <Button icon={UserPlus} onClick={() => setInviting(true)} disabled={used >= seats}>
            邀請教練
          </Button>
        }
      />
      {used >= seats && <p className="-mt-2 mb-4 text-[13px] text-ink-500">名額已滿。停用一位教練即可釋出名額。</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="教練" value={active.length} unit="位" icon={Users} sub={`含經營者・名額 ${seats} 位`} to="#coaches" />
        <Stat label="進行中學員" value={totals.students} unit="位" icon={Users} sub="全工作室" to="/coach/students" />
        <Stat label="本月完成課程" value={totals.sessions} unit="堂" icon={Check} sub="教練課，不含自主訓練" to="/coach/analytics" />
        <Stat label="堂數偏低" value={totals.low} unit="位" icon={Ticket} tone={totals.low ? 'warn' : 'default'} sub={`剩餘 ${LOW_BALANCE_THRESHOLD} 堂以下`} to="/coach/students?sort=balance" />
      </div>

      <Card id="coaches" className="mt-4 scroll-mt-16 md:scroll-mt-6">
        <CardHeader title="教練" description="停用教練前，會請你選擇由誰接手他的學員" />
        <ul className="divide-y divide-line border-t border-line">
          {studio.coaches.map((c) => {
            const st = statsFor(c.id)
            return (
              <li key={c.id} className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${c.status === 'inactive' ? 'opacity-60' : ''}`}>
                <Link to={`/coach/studio/coaches/${c.id}`} className="-my-1.5 -ml-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-subtle">
                  <Avatar name={c.name} id={c.id} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px] font-medium text-ink-900">
                      <span className="whitespace-nowrap">{c.name}</span>
                      {c.role === 'owner' && <Badge tone="accent">經營者</Badge>}
                      {c.status === 'invited' && <Badge tone="warn">待啟用</Badge>}
                      {c.status === 'inactive' && <Badge>已停用</Badge>}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {c.title ? `${c.title}・` : ''}
                      {c.email}
                    </p>
                    {c.status === 'active' && (
                      <p className="tabular mt-0.5 text-xs text-ink-600">
                        學員 {st.students}・本月 {st.sessions} 堂{st.low ? `・偏低 ${st.low}` : ''}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="flex shrink-0 gap-1.5">
                  {c.status === 'invited' && c.inviteCode && (
                    <Button variant="secondary" size="sm" icon={KeyRound} onClick={() => setShown({ coach: c, code: c.inviteCode! })}>
                      邀請碼
                    </Button>
                  )}
                  {c.role === 'coach' && c.status !== 'inactive' && (
                    <Button variant="ghost" size="sm" icon={UserMinus} onClick={() => setDeactivating(c)}>
                      {c.status === 'invited' ? '取消邀請' : '停用'}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
      <DemoNotice className="mt-6" />

      {inviting && (
        <InviteCoachModal
          onClose={() => setInviting(false)}
          onInvited={(r) => {
            setInviting(false)
            setShown(r)
          }}
        />
      )}
      {shown && <InviteCodeModal studioName={studio.name} invite={shown} onClose={() => setShown(null)} onReplace={setShown} />}
      {deactivating && <DeactivateCoachModal coach={deactivating} onClose={() => setDeactivating(null)} />}
    </div>
  )
}

function InviteCoachModal({ onClose, onInvited }: { onClose: () => void; onInvited: (r: { coach: CoachMember; code: string; expiresAt?: string }) => void }) {
  const { actions, reload } = useData()
  const { session } = useSession()
  const notify = useToast()
  const [form, setForm] = useState({ name: '', email: '', title: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return notify('請輸入姓名與 Email', 'error')
    if (!isApiMode) {
      const res = actions.inviteCoachDemo(form)
      if (!res.ok) return notify(res.error, 'error')
      return onInvited({ coach: res.value, code: res.value.inviteCode! })
    }
    if (!session?.token) return
    setBusy(true)
    try {
      const r: CoachInvite = await inviteCoach({ name: form.name.trim(), email: form.email.trim(), title: form.title.trim() || undefined }, session.token)
      await reload()
      onInvited({ coach: r.coach, code: r.inviteCode, expiresAt: r.expiresAt })
    } catch (err) {
      notify(err instanceof Error ? err.message : '無法邀請', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="邀請教練"
      description="教練用邀請碼設定密碼後即可登入，功能和自由教練相同，只會看到自己的學員。"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="h-11 md:h-10">
            取消
          </Button>
          <Button type="submit" form="invite-coach" className="h-11 md:h-10" disabled={busy}>
            {busy ? '處理中…' : '產生邀請碼'}
          </Button>
        </>
      }
    >
      <form id="invite-coach" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <TextInput label="姓名" required maxLength={30} value={form.name} onChange={set('name')} />
        <TextInput label="Email" required type="email" inputMode="email" value={form.email} onChange={set('email')} hint="教練之後用這個 Email 登入" />
        <TextInput label="職稱（選填）" maxLength={60} placeholder="例如：體能教練" value={form.title} onChange={set('title')} />
      </form>
    </Modal>
  )
}

function InviteCodeModal({
  studioName,
  invite,
  onClose,
  onReplace,
}: {
  studioName?: string
  invite: { coach: CoachMember; code: string; expiresAt?: string }
  onClose: () => void
  onReplace: (r: { coach: CoachMember; code: string; expiresAt?: string }) => void
}) {
  const { reload } = useData()
  const { session } = useSession()
  const notify = useToast()
  const [copied, setCopied] = useState(false)
  const message = `嗨 ${invite.coach.name}，邀請你加入${studioName ? ` ${studioName} ` : ''}的 ${BRAND.name}。請到登入頁選擇「邀請碼」，輸入 ${invite.code} 並設定密碼。`

  const regenerate = async () => {
    if (!session?.token) return
    try {
      const r = await reinviteCoach(invite.coach.id, session.token)
      await reload()
      onReplace({ coach: r.coach, code: r.inviteCode, expiresAt: r.expiresAt })
      notify('已產生新的邀請碼，舊的已失效', 'info')
    } catch (err) {
      notify(err instanceof Error ? err.message : '無法產生邀請碼', 'error')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`邀請 ${invite.coach.name}`}
      description="教練在登入頁選擇「邀請碼」，輸入下方代碼並設定密碼即可加入。"
      size="sm"
      footer={
        <Button
          icon={copied ? Check : Copy}
          className="h-11 md:h-10"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              notify('無法複製，請手動選取文字', 'error')
            }
          }}
        >
          {copied ? '已複製' : '複製邀請訊息'}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="num rounded-xl bg-raised py-5 text-center text-[34px] tracking-[0.2em] text-ink-900 select-all">{invite.code}</p>
        <p className="text-center text-[13px] text-ink-500">
          {invite.expiresAt ? `有效期限至 ${formatDate(invite.expiresAt, { year: true })}，使用一次後失效` : isApiMode ? '使用一次後失效' : '示範模式：此邀請碼僅供展示'}
        </p>
        <p className="rounded-lg bg-fill px-3 py-2.5 text-[13px] leading-relaxed text-ink-700">{message}</p>
        {isApiMode && (
          <Button variant="ghost" size="sm" icon={KeyRound} onClick={() => void regenerate()}>
            重新產生邀請碼
          </Button>
        )}
      </div>
    </Modal>
  )
}

function DeactivateCoachModal({ coach, onClose }: { coach: CoachMember; onClose: () => void }) {
  const { data, actions } = useData()
  const notify = useToast()
  const theirs = studentsOf(data, coach.id)
  const others = selectActiveCoaches(data).filter((c) => c.id !== coach.id)
  const [to, setTo] = useState(others.find((c) => c.role === 'owner')?.id ?? others[0]?.id ?? '')
  const pending = coach.status === 'invited'

  const confirm = () => {
    const res = actions.deactivateCoach(coach.id, theirs.length ? to : undefined)
    if (!res.ok) return notify(res.error, 'error')
    notify(pending ? `已取消邀請 ${coach.name}` : `已停用 ${coach.name}${theirs.length ? `，${theirs.length} 位學員已轉給 ${others.find((c) => c.id === to)?.name}` : ''}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={pending ? `取消邀請 ${coach.name}？` : `停用 ${coach.name}？`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="h-11 md:h-10">
            取消
          </Button>
          <Button variant="destructive" onClick={confirm} className="h-11 md:h-10" disabled={theirs.length > 0 && !to}>
            {pending ? '取消邀請' : '停用'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink-700">
        <p>{pending ? '邀請碼會失效，並釋出這個名額。' : `${coach.name} 將無法再登入，並釋出這個名額。過去的訓練紀錄會保留。`}</p>
        {theirs.length > 0 && (
          <SelectInput label={`${coach.name} 的 ${theirs.length} 位學員交給`} value={to} onChange={(e) => setTo(e.target.value)} hint="學員的訓練紀錄與堂數都會一起轉移">
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.role === 'owner' ? '（經營者）' : ''}
              </option>
            ))}
          </SelectInput>
        )}
      </div>
    </Modal>
  )
}

const studentsOf = (d: AppData, coachId: string) => d.relationships.filter((r) => r.coachId === coachId).map((r) => r.studentId)
