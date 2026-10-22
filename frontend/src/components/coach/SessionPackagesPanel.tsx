import { Minus, Pencil, Plus, SlidersHorizontal, Ticket, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatDate, formatDateTime, fromDateInput, toDateInput, twd } from '../../lib/format'
import { packageBalance, type PackageBalance } from '../../lib/sessions'
import { validatePackage, type PackageInput } from '../../store/actions'
import { useData, useToast } from '../../store/contexts'
import { selectBalance } from '../../store/selectors'
import type { ID, SessionPackage, TransactionType } from '../../types'
import { Button, IconButton } from '../ui/Button'
import { Segmented, TextArea, TextInput } from '../ui/Form'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { Badge, BalanceMeter, Card, CardHeader, EmptyState } from '../ui/Primitives'

const TX_LABEL: Record<TransactionType, string> = { deduction: '上課扣堂', reversal: '撤銷扣堂', adjustment: '手動調整' }

export function SessionPackagesPanel({ studentId }: { studentId: ID }) {
  const { data, actions } = useData()
  const notify = useToast()
  const balance = selectBalance(data, studentId)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<SessionPackage | null>(null)
  const [adjusting, setAdjusting] = useState<PackageBalance | null>(null)
  const [deleting, setDeleting] = useState<SessionPackage | null>(null)

  const pkgName = new Map(balance.packages.map((b) => [b.pkg.id, b.pkg.name]))
  const history = data.transactions
    .filter((t) => t.studentId === studentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const workoutTitle = (id?: ID) => data.workouts.find((w) => w.id === id)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5 sm:col-span-1">
          <p className="text-[13px] text-ink-500">目前剩餘堂數</p>
          <p className={`mt-1 num text-[32px] tracking-tight ${balance.remaining <= 3 ? 'text-warn-600' : 'text-ink-900'}`}>
            {balance.remaining}
            <span className="ml-1 text-base font-normal text-ink-500">堂</span>
          </p>
          <p className="mt-2 text-xs text-ink-500">由所有方案的總堂數與異動紀錄計算而來</p>
        </Card>
        <Card className="grid grid-cols-2 gap-4 p-5 sm:col-span-2">
          <div>
            <p className="text-[13px] text-ink-500">累計購買</p>
            <p className="mt-1 text-2xl font-semibold text-ink-900">{balance.totalPurchased} 堂</p>
          </div>
          <div>
            <p className="text-[13px] text-ink-500">已使用</p>
            <p className="mt-1 text-2xl font-semibold text-ink-900">{balance.used} 堂</p>
          </div>
          <p className="col-span-2 text-xs text-ink-500">
            {balance.nextPackage ? `下次扣堂將從「${balance.nextPackage.pkg.name}」扣除（依購買日期先後）。` : '目前沒有可扣除的堂數，請新增課程方案。'}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="課程方案"
          description="每個方案獨立計算已用與剩餘堂數"
          action={
            <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
              新增方案
            </Button>
          }
        />
        {balance.packages.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {[...balance.packages].reverse().map((b) => (
              <li key={b.pkg.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{b.pkg.name}</p>
                      {b.remaining === 0 ? <Badge>已用完</Badge> : <Badge tone="accent">使用中</Badge>}
                      {b.pkg.expiresAt && new Date(b.pkg.expiresAt) < new Date() && b.remaining > 0 && <Badge tone="warn">已過期</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      購買 {formatDate(b.pkg.purchaseDate, { year: true })}
                      {b.pkg.expiresAt ? `・到期 ${formatDate(b.pkg.expiresAt, { year: true })}` : ''}
                      {b.pkg.priceTwd > 0 ? `・${twd(b.pkg.priceTwd)}` : ''}
                    </p>
                    {b.pkg.notes && <p className="mt-1 text-xs text-ink-500">{b.pkg.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" icon={SlidersHorizontal} onClick={() => setAdjusting(b)}>
                      調整
                    </Button>
                    <IconButton icon={Pencil} label="編輯方案" size="sm" onClick={() => setEditing(b.pkg)} />
                    {b.transactions.length === 0 && <IconButton icon={Trash2} label="刪除方案" size="sm" tone="danger" onClick={() => setDeleting(b.pkg)} />}
                  </div>
                </div>
                <div className="tabular mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    ['總堂數', b.total],
                    ['已使用', b.used],
                    ['調整', b.adjusted > 0 ? `+${b.adjusted}` : b.adjusted],
                    ['剩餘', b.remaining],
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-canvas py-2">
                      <p className="text-ink-500">{l}</p>
                      <p className="mt-0.5 text-base font-semibold text-ink-900">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <BalanceMeter remaining={b.remaining} total={b.total + Math.max(0, b.adjusted)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={Ticket}
            title="尚未建立課程方案"
            description="建立方案後才能扣除堂數。"
            action={
              <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                新增方案
              </Button>
            }
          />
        )}
      </Card>

      <Card>
        <CardHeader title="堂數異動紀錄" description="每一筆扣堂、撤銷與調整都會保留" />
        {history.length ? (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-subtle/60 text-left text-xs text-ink-500">
                <tr>
                  <th className="px-5 py-2 font-medium">時間</th>
                  <th className="px-3 py-2 font-medium">類型</th>
                  <th className="px-3 py-2 font-medium">說明</th>
                  <th className="px-3 py-2 font-medium">方案</th>
                  <th className="px-5 py-2 text-right font-medium">堂數</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((t) => {
                  const w = workoutTitle(t.workoutSessionId)
                  return (
                    <tr key={t.id}>
                      <td className="tabular px-5 py-2.5 whitespace-nowrap text-ink-600">{formatDateTime(t.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={t.type === 'deduction' ? 'neutral' : t.type === 'reversal' ? 'accent' : 'warn'}>{TX_LABEL[t.type]}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-ink-800">
                        {t.reason}
                        {w && t.type !== 'deduction' && <span className="text-ink-500">（{w.title}）</span>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-500">{pkgName.get(t.packageId)}</td>
                      <td className={`tabular px-5 py-2.5 text-right font-semibold ${t.delta < 0 ? 'text-ink-900' : 'text-accent-700'}`}>
                        {t.delta > 0 ? `+${t.delta}` : t.delta}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState compact icon={Ticket} title="尚無異動紀錄" />
        )}
      </Card>

      {(creating || editing) && (
        <PackageFormModal
          pkg={editing ?? undefined}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={(input) => {
            const res = editing ? actions.updatePackage(editing.id, input) : actions.addPackage(studentId, input)
            if (!res.ok) {
              notify(res.error, 'error')
              return false
            }
            notify(editing ? '方案已更新' : `已新增方案「${input.name}」`)
            return true
          }}
        />
      )}

      {adjusting && <AdjustModal balance={adjusting} onClose={() => setAdjusting(null)} />}

      <ConfirmDialog
        open={!!deleting}
        title="刪除此方案？"
        description="此方案尚無任何異動紀錄，刪除後無法復原。"
        confirmLabel="刪除"
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          const res = actions.deletePackage(deleting.id)
          setDeleting(null)
          notify(res.ok ? '方案已刪除' : res.error, res.ok ? 'success' : 'error')
        }}
      />
    </div>
  )
}

const PRESETS = [
  { sessions: 10, price: 18000 },
  { sessions: 20, price: 34000 },
]

function PackageFormModal({ pkg, onClose, onSubmit }: { pkg?: SessionPackage; onClose: () => void; onSubmit: (input: PackageInput) => boolean }) {
  const [name, setName] = useState(pkg?.name ?? '10 堂一對一課程')
  const [sessions, setSessions] = useState(String(pkg?.totalSessions ?? 10))
  const [price, setPrice] = useState(String(pkg?.priceTwd ?? 18000))
  const [purchase, setPurchase] = useState(toDateInput(pkg?.purchaseDate ?? new Date()))
  const [expires, setExpires] = useState(pkg?.expiresAt ? toDateInput(pkg.expiresAt) : '')
  const [notes, setNotes] = useState(pkg?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const input = (): PackageInput => ({
    name,
    totalSessions: Number(sessions),
    priceTwd: Number(price || 0),
    purchaseDate: purchase ? fromDateInput(purchase) : '',
    expiresAt: expires ? fromDateInput(expires) : undefined,
    notes: notes.trim() || undefined,
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = input()
    const errs = validatePackage(v)
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (onSubmit(v)) onClose()
  }

  const perSession = Number(sessions) > 0 && Number(price) > 0 ? Math.round(Number(price) / Number(sessions)) : null

  return (
    <Modal
      open
      onClose={onClose}
      title={pkg ? '編輯課程方案' : '新增課程方案'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="h-11 md:h-10">
            取消
          </Button>
          <Button type="submit" form="package-form" className="h-11 md:h-10">
            {pkg ? '儲存' : '建立方案'}
          </Button>
        </>
      }
    >
      <form id="package-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {!pkg && (
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium text-ink-700">快速選擇</p>
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.sessions}
                  type="button"
                  onClick={() => {
                    setSessions(String(p.sessions))
                    setPrice(String(p.price))
                    setName(`${p.sessions} 堂一對一課程`)
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-left text-sm ${
                    Number(sessions) === p.sessions ? 'border-accent-600 bg-accent-50' : 'border-line hover:bg-subtle'
                  }`}
                >
                  <span className="block font-medium text-ink-900">{p.sessions} 堂</span>
                  <span className="text-xs text-ink-500">{twd(p.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <TextInput label="方案名稱" required containerClassName="sm:col-span-2" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextInput
          label="總堂數"
          required
          inputMode="numeric"
          value={sessions}
          onChange={(e) => setSessions(e.target.value.replace(/\D/g, '').slice(0, 3))}
          error={errors.totalSessions}
        />
        <TextInput
          label="金額 (TWD)"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 7))}
          error={errors.priceTwd}
          hint={perSession ? `每堂約 ${twd(perSession)}` : undefined}
        />
        <TextInput label="購買日期" required type="date" value={purchase} onChange={(e) => setPurchase(e.target.value)} error={errors.purchaseDate} />
        <TextInput label="到期日（選填）" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} error={errors.expiresAt} />
        <TextArea label="備註" containerClassName="sm:col-span-2" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
      </form>
    </Modal>
  )
}

function AdjustModal({ balance, onClose }: { balance: PackageBalance; onClose: () => void }) {
  const { data, actions } = useData()
  const notify = useToast()
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [amount, setAmount] = useState('1')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const live = packageBalance(balance.pkg, data.transactions)
  const n = Number(amount) || 0
  const delta = direction === 'add' ? n : -n
  const after = live.remaining + delta

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (n < 1) return setError('請輸入至少 1 堂')
    if (!reason.trim()) return setError('請輸入調整原因，方便日後查核')
    if (after < 0) return setError(`剩餘 ${live.remaining} 堂，最多只能扣除 ${live.remaining} 堂`)
    const res = actions.adjustPackage(balance.pkg.id, delta, reason)
    if (!res.ok) return setError(res.error)
    notify(`已${direction === 'add' ? '增加' : '扣除'} ${n} 堂，方案剩餘 ${res.value} 堂`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="手動調整堂數"
      description={balance.pkg.name}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="h-11 md:h-10">
            取消
          </Button>
          <Button type="submit" form="adjust-form" className="h-11 md:h-10" disabled={after < 0}>
            確認調整
          </Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={submit} noValidate className="space-y-4">
        <Segmented
          label="調整方向"
          value={direction}
          onChange={(v) => {
            setDirection(v)
            setError(null)
          }}
          options={[
            { value: 'add', label: '增加堂數' },
            { value: 'remove', label: '扣除堂數' },
          ]}
        />
        <div className="flex items-center gap-2">
          <IconButton icon={Minus} label="減少" size="lg" className="border border-line" onClick={() => setAmount(String(Math.max(1, n - 1)))} />
          <input
            aria-label="調整堂數"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/\D/g, '').slice(0, 2))
              setError(null)
            }}
            className="tabular h-11 w-20 rounded-lg border border-line-strong text-center text-lg font-semibold focus:border-accent-500 focus:outline-none"
          />
          <IconButton icon={Plus} label="增加" size="lg" className="border border-line" onClick={() => setAmount(String(Math.min(50, n + 1)))} />
          <span className="text-sm text-ink-500">堂</span>
        </div>
        <div className="rounded-lg bg-canvas px-3 py-2.5 text-sm text-ink-700">
          剩餘 <strong>{live.remaining}</strong> → <strong className={after < 0 ? 'text-danger-600' : 'text-accent-700'}>{after}</strong> 堂
          {after < 0 && <span className="ml-2 text-danger-600">餘額不可為負</span>}
        </div>
        <TextInput
          label="原因"
          required
          placeholder={direction === 'add' ? '例如：教練臨時調課，補償 1 堂' : '例如：未提前取消，依約定扣除'}
          value={reason}
          maxLength={60}
          onChange={(e) => {
            setReason(e.target.value)
            setError(null)
          }}
        />
        {error && (
          <p className="text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
