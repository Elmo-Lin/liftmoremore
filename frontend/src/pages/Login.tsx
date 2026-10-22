import { ArrowRight, ChartLine, ClipboardList, Dumbbell, Ticket, UserRound, Users } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { activateInvite, demoLogin, login, registerCoach } from '../api/auth'
import { isApiMode } from '../api/client'
import { Logo } from '../components/layout/AppShell'
import { Button } from '../components/ui/Button'
import { Segmented, TextInput } from '../components/ui/Form'
import { DemoNotice } from '../components/ui/Primitives'
import type { DemoSession } from '../types'
import { BRAND } from '../config/brand'
import { DEFAULT_DEMO_STUDENT_ID } from '../data/mock'
import { useData, useSession, useToast } from '../store/contexts'

const FEATURES = [
  { icon: Users, title: '學員管理', text: '目標、備註與訓練頻率集中在一處。' },
  { icon: Dumbbell, title: '快速記錄', text: '為手機操作設計，一組只需幾次點擊。' },
  { icon: Ticket, title: '堂數清楚', text: '記錄訓練與扣堂分開，每筆異動都留紀錄。' },
  { icon: ChartLine, title: '看得見進步', text: '重量、訓練量與頻率，用一致的指標呈現。' },
]

export function LoginPage() {
  const { signIn } = useSession()
  const { data } = useData()
  const navigate = useNavigate()
  const notify = useToast()
  const location = useLocation()
  const missingStudent = (location.state as { missingStudent?: boolean } | null)?.missingStudent

  const demoStudent = data.students.find((s) => s.id === DEFAULT_DEMO_STUDENT_ID) ?? data.students.find((s) => s.status === 'active')

  const continueAs = (role: 'coach' | 'student') => {
    if (role === 'student' && !demoStudent) {
      notify('目前沒有學員可供示範，請先以教練身分新增學員', 'error')
      return
    }
    signIn({ role, studentId: demoStudent?.id ?? DEFAULT_DEMO_STUDENT_ID })
    navigate(role === 'coach' ? '/coach' : '/student', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto grid min-h-dvh max-w-6xl gap-10 px-4 py-8 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-16 md:px-8">
        <section>
          <Logo />
          <h1 className="mt-10 text-[30px] leading-tight font-semibold tracking-tight text-ink-900 md:text-[40px]">
            {BRAND.tagline.split('，')[0]}，
            <br />
            <span className="text-accent-700">{BRAND.tagline.split('，')[1]}</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-600">
            為台灣獨立教練打造的課程管理工具：學員、課表、堂數與訓練紀錄，一個地方搞定。
          </p>
          <ul className="mt-8 grid max-w-lg gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent-700">
                  <f.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">{f.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {isApiMode ? (
          <ApiAuthPanel />
        ) : (
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
          <h2 className="text-lg font-semibold text-ink-900">進入示範版本</h2>
          <p className="mt-1 text-sm text-ink-500">不需註冊或登入。你的操作會儲存在此瀏覽器中。</p>
          {missingStudent && (
            <p className="mt-4 rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn-600">原本示範的學員已被刪除，請重新選擇身分。</p>
          )}
          <div className="mt-6 space-y-3">
            <RoleButton
              icon={ClipboardList}
              title="以教練身分繼續"
              text={`${data.coach.name}・管理 ${data.students.length} 位學員`}
              onClick={() => continueAs('coach')}
            />
            <RoleButton
              icon={UserRound}
              title="以學員身分繼續"
              text={demoStudent ? `${demoStudent.name}・查看課表與進步` : '尚無學員'}
              onClick={() => continueAs('student')}
            />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-ink-500">登入後可隨時從側邊欄或右上角切換身分，也可以重設示範資料。</p>
          <DemoNotice className="mt-4" />
        </section>
        )}
      </div>
    </div>
  )
}

function RoleButton({ icon: Icon, title, text, onClick }: { icon: typeof Users; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-line-strong bg-surface px-4 py-4 text-left transition-colors hover:border-accent-600 hover:bg-accent-50"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink-700 group-hover:bg-accent-100 group-hover:text-accent-700">
        <Icon className="size-5" />
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-ink-900">{title}</span>
        <span className="mt-0.5 block text-[13px] text-ink-500">{text}</span>
      </span>
      <ArrowRight className="size-4 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700" />
    </button>
  )
}

type AuthTab = 'demo' | 'login' | 'register' | 'invite'

/** Backend-connected sign-in: demo accounts, email/password, coach sign-up, student invite. */
function ApiAuthPanel() {
  const { signIn } = useSession()
  const navigate = useNavigate()
  const notify = useToast()
  const [tab, setTab] = useState<AuthTab>('demo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', studio: '', code: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  const run = async (task: () => Promise<DemoSession>) => {
    setBusy(true)
    setError(null)
    try {
      const session = await task()
      signIn(session)
      navigate(session.role === 'coach' ? '/coach' : '/student', { replace: true })
      notify(`歡迎，${session.name ?? ''}`, 'info')
    } catch (e) {
      setError(e instanceof Error ? e.message : '登入失敗')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tab === 'login') void run(() => login(form.email, form.password))
    if (tab === 'register') void run(() => registerCoach({ name: form.name, email: form.email, password: form.password, studio: form.studio }))
    if (tab === 'invite') void run(() => activateInvite(form.code, form.password))
  }

  return (
    <section className="rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.05)] md:p-8">
      <h2 className="text-lg font-semibold text-ink-900">登入 {BRAND.name}</h2>
      <p className="mt-1 text-sm text-ink-500">資料會安全地儲存在伺服器，換裝置也能繼續使用。</p>
      <div className="mt-5 overflow-x-auto">
        <Segmented
          label="登入方式"
          value={tab}
          onChange={(t) => {
            setTab(t)
            setError(null)
          }}
          options={[
            { value: 'demo', label: '示範' },
            { value: 'login', label: '登入' },
            { value: 'register', label: '註冊教練' },
            { value: 'invite', label: '邀請碼' },
          ]}
        />
      </div>

      {tab === 'demo' ? (
        <div className="mt-5 space-y-3">
          <RoleButton icon={ClipboardList} title="以示範教練登入" text="林子傑・11 位示範學員" onClick={() => !busy && void run(() => demoLogin('coach'))} />
          <RoleButton icon={UserRound} title="以示範學員登入" text="陳怡君・查看課表與進步" onClick={() => !busy && void run(() => demoLogin('student'))} />
          <p className="text-xs leading-relaxed text-ink-500">第一次使用時會自動匯入示範資料。示範帳號密碼皆為 demo1234。</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 space-y-3.5">
          {tab === 'register' && <TextInput label="姓名" value={form.name} onChange={set('name')} autoComplete="name" />}
          {tab === 'invite' ? (
            <TextInput label="邀請碼" value={form.code} onChange={set('code')} placeholder="教練提供的 8 碼邀請碼" autoCapitalize="characters" />
          ) : (
            <TextInput label="Email" type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="email" />
          )}
          <TextInput
            label={tab === 'login' ? '密碼' : '設定密碼'}
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            hint={tab === 'login' ? undefined : '至少 8 個字元'}
          />
          {tab === 'register' && <TextInput label="工作室名稱（選填）" value={form.studio} onChange={set('studio')} />}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? '處理中…' : tab === 'login' ? '登入' : tab === 'register' ? '建立教練帳號' : '啟用學員帳號'}
          </Button>
        </form>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
