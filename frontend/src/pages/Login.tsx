import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { activateInvite, forgotPassword, googleSignIn, login, registerCoach, registerSelf, registerStudio, resetPassword } from '../api/auth'
import { API_URL, ApiError, enterLocalDemo, exitLocalDemo, isApiMode } from '../api/client'
import { GoogleButton } from '../components/auth/GoogleButton'
import { Logo } from '../components/layout/AppShell'
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

const PANEL_CLASS = 'rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.05)] md:p-8'

/**
 * Sign-in, the demo picker and password reset: the logo (back to the home page, which explains the
 * product) above one centred panel, so on a phone the form fits without scrolling.
 */
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:justify-center md:py-10">
      <Link to="/" aria-label={`${BRAND.name} 首頁`} className="mb-5">
        <Logo />
      </Link>
      <div className="w-full max-w-md">{children}</div>
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
        <DemoNotice className="mt-4" always />
      </section>
    </AuthLayout>
  )
}

type AuthTab = 'login' | 'register' | 'invite'
type AccountType = 'self' | 'coach' | 'studio'

const ACCOUNT_HINT = {
  self: `自己記錄訓練、追蹤進步，不需要教練。免費試用 ${TRIAL_DAYS} 天，不需信用卡；之後 NT$${PLANS.self.price}/月。`,
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
  const [params] = useSearchParams()
  // The public pages' "free trial" buttons open the sign-up tab.
  const [tab, setTab] = useState<AuthTab>(params.get('tab') === 'register' ? 'register' : 'login')
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

  const panelClass = PANEL_CLASS
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
        <AgreementNote register />
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
        {tab === 'login' && (
          <p className="-mt-1.5 text-right text-[13px]">
            <Link to="/forgot-password" className="text-accent-700 hover:underline">
              忘記密碼？
            </Link>
          </p>
        )}
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
      <AgreementNote register={tab === 'register'} />
    </section>
  )
}

// ----------------------------------------------------------------------------- forgot / reset password

/** /forgot-password: mail a reset link. The answer never says whether the email is registered. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('請輸入正確的 Email')
    setBusy(true)
    setError(null)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '寄送失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <section className={PANEL_CLASS}>
        <h2 className="text-lg font-semibold text-ink-900">忘記密碼</h2>
        {sent ? (
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-600">
            <p>
              如果 <strong className="text-ink-900">{email.trim()}</strong> 有註冊，我們已經寄出重設密碼的連結，請在 1 小時內點開。
            </p>
            <p className="text-[13px] text-ink-500">沒收到的話，請看看垃圾郵件匣，或過一分鐘再試一次。用 Google 註冊的帳號，也可以直接用 Google 登入。</p>
            <Button variant="secondary" className="w-full" onClick={() => setSent(false)}>
              重新寄送
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 space-y-3.5">
            <p className="text-sm text-ink-600">輸入註冊時的 Email，我們會寄一封重設密碼的信給你。</p>
            <TextInput label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? '寄送中…' : '寄送重設連結'}
            </Button>
          </form>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}
        <p className="mt-5 text-center text-[13px]">
          <Link to="/login" className="text-accent-700 hover:underline">
            回到登入
          </Link>
        </p>
      </section>
    </AuthLayout>
  )
}

/** /reset-password?token=…: the link from the email. Sets the new password and signs in. */
export function ResetPasswordPage() {
  const { signIn } = useSession()
  const navigate = useNavigate()
  const notify = useToast()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('密碼至少 8 個字元')
    if (password !== confirm) return setError('兩次輸入的密碼不一致')
    setBusy(true)
    setError(null)
    try {
      const session = await resetPassword(token, password)
      signIn(session)
      navigate(homePath(session.role), { replace: true })
      notify('密碼已更新，已為你登入')
    } catch (err) {
      setError(err instanceof Error ? err.message : '重設失敗，請重新申請')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <section className={PANEL_CLASS}>
        <h2 className="text-lg font-semibold text-ink-900">設定新密碼</h2>
        {token ? (
          <form onSubmit={submit} noValidate className="mt-4 space-y-3.5">
            <TextInput label="新密碼" type="password" autoComplete="new-password" hint="至少 8 個字元" value={password} onChange={(e) => setPassword(e.target.value)} />
            <TextInput label="再次輸入新密碼" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? '處理中…' : '更新密碼並登入'}
            </Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-ink-600">這個連結不完整，請從信中的按鈕重新開啟，或重新申請。</p>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}
        <p className="mt-5 text-center text-[13px]">
          <Link to="/forgot-password" className="text-accent-700 hover:underline">
            重新申請重設連結
          </Link>
        </p>
      </section>
    </AuthLayout>
  )
}

/** Signing up accepts the terms; the links are also how reviewers and visitors find the policies. */
function AgreementNote({ register }: { register: boolean }) {
  const link = 'text-accent-700 hover:underline'
  return (
    <p className="mt-5 text-center text-xs leading-relaxed text-ink-500">
      {register ? '註冊即表示你同意' : '使用本服務即表示你同意'}
      <Link to="/terms" className={link}>
        服務條款
      </Link>
      與
      <Link to="/privacy" className={link}>
        隱私權政策
      </Link>
      。
      <Link to="/" className={`ml-2 ${link}`}>
        回首頁
      </Link>
    </p>
  )
}
