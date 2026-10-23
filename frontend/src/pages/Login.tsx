import { ArrowRight, ChartLine, Dumbbell, Ticket, Users } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { activateInvite, googleSignIn, login, registerCoach, registerSelf, registerStudio } from '../api/auth'
import { API_URL, ApiError, enterLocalDemo, exitLocalDemo, isApiMode } from '../api/client'
import { GoogleButton } from '../components/auth/GoogleButton'
import { Logo, MobileTopBar } from '../components/layout/AppShell'
import { DemoPersonaList } from '../components/layout/DemoPersonas'
import { Button } from '../components/ui/Button'
import { Segmented, TextInput } from '../components/ui/Form'
import { DemoNotice } from '../components/ui/Primitives'
import type { DemoSession } from '../types'
import { BRAND } from '../config/brand'
import { demoHome, demoSession, type DemoPersona } from '../data/mock'
import { PLANS, TRIAL_DAYS } from '../lib/billing'
import { GOOGLE_CLIENT_ID, googleProfile } from '../lib/google'
import { homePath } from '../lib/roles'
import { useSession, useToast } from '../store/contexts'

const FEATURES = [
  { icon: Dumbbell, title: '快速記錄', text: '為手機設計，一組只需幾次點擊。' },
  { icon: ChartLine, title: '看得見進步', text: '重量、訓練量與頻率一目了然。' },
  { icon: Users, title: '學員管理', text: '教練可集中管理學員與課表。' },
  { icon: Ticket, title: '堂數清楚', text: '記錄訓練與扣堂分開，異動都留紀錄。' },
]

/** Headline, features and a panel on the right (sign-in, or the demo picker). */
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* Mobile: headline → panel → features, so the panel is reachable without scrolling.
          Desktop: headline and features on the left, the panel on the right. */}
      <MobileTopBar />
      <div className="mx-auto grid min-h-dvh max-w-6xl content-start gap-6 px-4 pt-[calc(3rem+1.25rem)] pb-6 md:grid-cols-[1.1fr_1fr] md:content-center md:gap-x-16 md:gap-y-8 md:px-8 md:py-8">
        <section className="md:col-start-1 md:row-start-1 md:self-end">
          {/* Phones show the logo in the fixed top bar instead. */}
          <div className="hidden md:block">
            <Logo />
          </div>
          <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-ink-900 md:mt-10 md:text-[40px]">
            {BRAND.tagline[0]}
            <br />
            <span className="text-accent-700">{BRAND.tagline[1]}</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-600">
            為台灣自由教練打造的課程管理工具：學員、課表、堂數與訓練紀錄，一個地方搞定。自己練的人也能用它記錄訓練、追蹤進步。
          </p>
        </section>

        <div className="md:col-start-2 md:row-span-2 md:row-start-1 md:self-center">{children}</div>

        <ul className="grid max-w-lg gap-4 pb-4 sm:grid-cols-2 md:col-start-1 md:row-start-2 md:self-start md:pb-0">
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
      </div>
    </div>
  )
}

export function LoginPage() {
  const location = useLocation()
  // Without a backend (or inside the browser-only demo) there is nothing to sign in to.
  if (!isApiMode) return <Navigate to="/demo" replace state={location.state} />
  return (
    <AuthLayout>
      <ApiAuthPanel />
    </AuthLayout>
  )
}

/** /demo: try the app with made-up data kept in this browser. Not linked from the sign-in page. */
export function DemoPage() {
  const notify = useToast()
  const location = useLocation()
  const missingStudent = (location.state as { missingStudent?: boolean } | null)?.missingStudent

  // A full page load opens the persona's own demo workspace (studio, free coach or self-tracker).
  const continueAs = (persona: DemoPersona) => {
    if (!enterLocalDemo(demoSession(persona), demoHome(persona))) notify('此瀏覽器無法儲存示範資料，請關閉無痕模式後再試', 'error')
  }

  return (
    <AuthLayout>
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
        <h2 className="text-lg font-semibold text-ink-900">進入示範版本</h2>
        <p className="mt-1 text-sm text-ink-500">不需註冊或登入。你的操作只會儲存在此瀏覽器中，不會影響任何人。</p>
        {missingStudent && (
          <p className="mt-4 rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn-600">原本示範的學員已被刪除，請重新選擇身分。</p>
        )}
        <div className="mt-6">
          <DemoPersonaList onPick={continueAs} />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-ink-500">進入後可隨時從側邊欄或右上角切換身分，也可以重設示範資料。</p>
        {API_URL && (
          <button type="button" onClick={exitLocalDemo} className="group mt-5 flex w-full items-center gap-3 border-t border-line pt-4 text-left">
            <span className="flex-1">
              <span className="block text-sm font-medium text-ink-900">準備好開始了？</span>
              <span className="mt-0.5 block text-[13px] text-ink-500">登入或註冊正式帳號，教練免費試用 {TRIAL_DAYS} 天。</span>
            </span>
            <ArrowRight className="size-4 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700" />
          </button>
        )}
        <DemoNotice className="mt-4" />
      </section>
    </AuthLayout>
  )
}

type AuthTab = 'login' | 'register' | 'invite'
type AccountType = 'self' | 'coach' | 'studio'

const ACCOUNT_HINT = {
  self: '自己記錄訓練、追蹤進步，不需要教練。免費使用。',
  coach: `一個人帶學員：管理學員、課表、訓練計畫與堂數。免費試用 ${TRIAL_DAYS} 天，不需信用卡；之後 NT$${PLANS.pro.price}/月。`,
  studio: `工作室經營者：自己也能帶學員，含 ${PLANS.team.coaches} 位教練、${PLANS.team.students} 位活躍學員。免費試用 ${TRIAL_DAYS} 天，之後 NT$${PLANS.team.price}/月。工作室的教練請向經營者索取邀請碼。`,
} as const

const ACCOUNT_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'self', label: '自主訓練' },
  { value: 'coach', label: '自由教練' },
  { value: 'studio', label: '工作室' },
]

const REGISTER_LABEL = { self: '建立帳號', coach: '建立教練帳號', studio: '建立工作室' } as const

/** Backend-connected sign-in: Google, email/password, sign-up (self-tracker, coach or studio), invite code. */
function ApiAuthPanel() {
  const { signIn } = useSession()
  const navigate = useNavigate()
  const notify = useToast()
  const [tab, setTab] = useState<AuthTab>('login')
  const [accountType, setAccountType] = useState<AccountType>('self')
  /** A first-time Google user: their token, kept while they pick an account type. */
  const [googleSignup, setGoogleSignup] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', studio: '', code: '' })
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
      navigate(homePath(session.role), { replace: true })
      notify(`歡迎，${session.name ?? ''}`, 'info')
    } catch (e) {
      setError(e instanceof Error ? e.message : '登入失敗')
    } finally {
      setBusy(false)
    }
  }

  const withGoogle = async (credential: string) => {
    setBusy(true)
    setError(null)
    try {
      const session = await googleSignIn(credential)
      signIn(session)
      navigate(homePath(session.role), { replace: true })
      notify(`歡迎，${session.name ?? ''}`, 'info')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'signup_required') setGoogleSignup(credential)
      else setError(e instanceof Error ? e.message : '登入失敗')
    } finally {
      setBusy(false)
    }
  }

  const finishGoogleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!googleSignup) return
    if (accountType === 'studio' && !form.studio.trim()) return setError('請輸入工作室名稱')
    void run(() => googleSignIn(googleSignup, { accountType, studio: accountType === 'studio' ? form.studio : undefined }))
  }

  // Sign-up and invite activation set a new password, so ask for it twice.
  const settingPassword = tab !== 'login'
  const [submitted, setSubmitted] = useState(false)
  const mismatch = settingPassword && (form.confirm !== '' || submitted) && form.confirm !== form.password

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (settingPassword && form.confirm !== form.password) return // shown under the confirm field
    if (tab === 'login') void run(() => login(form.email, form.password))
    if (tab === 'register' && accountType === 'self') void run(() => registerSelf({ name: form.name, email: form.email, password: form.password }))
    if (tab === 'register' && accountType === 'studio') {
      if (!form.studio.trim()) return setError('請輸入工作室名稱')
      void run(() => registerStudio({ name: form.name, email: form.email, password: form.password, studio: form.studio }))
    }
    if (tab === 'register' && accountType === 'coach') void run(() => registerCoach({ name: form.name, email: form.email, password: form.password }))
    if (tab === 'invite') void run(() => activateInvite(form.code, form.password))
  }

  const panelClass = 'rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.05)] md:p-8'
  const errorBox = error && (
    <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">
      {error}
    </p>
  )

  if (googleSignup) {
    const profile = googleProfile(googleSignup)
    return (
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-ink-900">完成註冊</h2>
        <p className="mt-1 text-sm text-ink-500">
          以 Google 帳號 {profile.email} 建立{profile.name ? `「${profile.name}」的` : ''}帳號。
        </p>
        <form onSubmit={finishGoogleSignup} noValidate className="mt-5 space-y-3.5">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-700">帳號類型</p>
            <Segmented
              label="帳號類型"
              value={accountType}
              onChange={(t) => {
                setAccountType(t)
                setError(null)
              }}
              options={ACCOUNT_OPTIONS}
            />
            <p className="mt-1.5 text-xs text-ink-500">{ACCOUNT_HINT[accountType]}</p>
          </div>
          {accountType === 'studio' && <TextInput label="工作室名稱" required value={form.studio} onChange={set('studio')} />}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? '處理中…' : REGISTER_LABEL[accountType]}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setGoogleSignup(null)
              setError(null)
            }}
          >
            返回
          </Button>
        </form>
        {errorBox}
      </section>
    )
  }

  return (
    <section className={panelClass}>
      <h2 className="text-lg font-semibold text-ink-900">登入 {BRAND.name}</h2>
      <div className="mt-4 overflow-x-auto">
        <Segmented
          label="登入方式"
          value={tab}
          onChange={(t) => {
            setTab(t)
            setError(null)
            setSubmitted(false)
          }}
          options={[
            { value: 'login', label: '登入' },
            { value: 'register', label: '註冊' },
            { value: 'invite', label: '邀請碼' },
          ]}
        />
      </div>

      {tab !== 'invite' && GOOGLE_CLIENT_ID && (
        <div className="mt-5">
          <GoogleButton onCredential={(c) => void withGoogle(c)} text={tab === 'register' ? 'signup_with' : 'continue_with'} />
          <div className="mt-5 flex items-center gap-3 text-xs text-ink-400">
            <span className="h-px flex-1 bg-line" />
            或使用 Email
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      )}
      <form onSubmit={submit} noValidate className="mt-5 space-y-3.5">
        {tab === 'register' && (
          <>
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-700">帳號類型</p>
              <Segmented
                label="帳號類型"
                value={accountType}
                onChange={(t) => {
                  setAccountType(t)
                  setError(null)
                }}
                options={ACCOUNT_OPTIONS}
              />
              <p className="mt-1.5 text-xs text-ink-500">{ACCOUNT_HINT[accountType]}</p>
            </div>
            <TextInput label="姓名" value={form.name} onChange={set('name')} autoComplete="name" />
          </>
        )}
        {tab === 'invite' ? (
          <TextInput
            label="邀請碼"
            value={form.code}
            onChange={set('code')}
            placeholder="教練或工作室提供的 8 碼邀請碼"
            autoCapitalize="characters"
            hint={GOOGLE_CLIENT_ID ? '也可以不用邀請碼：在「登入」用受邀的 Email 以 Google 登入。' : undefined}
          />
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
        {settingPassword && (
          <TextInput
            label="再次輸入密碼"
            type="password"
            value={form.confirm}
            onChange={set('confirm')}
            autoComplete="new-password"
            error={mismatch ? (form.confirm ? '兩次輸入的密碼不一致' : '請再次輸入密碼') : undefined}
          />
        )}
        {tab === 'register' && accountType === 'studio' && <TextInput label="工作室名稱" required value={form.studio} onChange={set('studio')} />}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? '處理中…' : tab === 'login' ? '登入' : tab === 'register' ? REGISTER_LABEL[accountType] : '啟用帳號'}
        </Button>
      </form>
      {errorBox}
    </section>
  )
}
