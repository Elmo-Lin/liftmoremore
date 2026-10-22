import { ArrowLeftRight, LogOut, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { demoLogin } from '../../api/auth'
import { isApiMode } from '../../api/client'
import { DEFAULT_DEMO_STUDENT_ID } from '../../data/mock'
import { useData, useSession, useToast } from '../../store/contexts'
import type { Role } from '../../types'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Form'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { Avatar, Badge } from '../ui/Primitives'

type Placement = 'sidebar' | 'topbar'

export function RoleSwitcher({ placement }: { placement: Placement }) {
  const { session } = useSession()
  return session?.role === 'self' ? <SelfAccount placement={placement} /> : <DemoRoleSwitcher placement={placement} />
}

/** Self-trackers have one identity and nothing to switch to: show who is signed in and a sign-out. */
function SelfAccount({ placement }: { placement: Placement }) {
  const { data } = useData()
  const { session, signOut } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const student = data.students.find((s) => s.id === session?.studentId)
  const name = student?.name ?? session?.name ?? ''
  const id = student?.id ?? 'x'
  const logOut = () => {
    signOut()
    navigate('/login')
  }

  if (placement === 'sidebar') {
    return (
      <div className="rounded-xl bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_0.5px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2.5">
          <Avatar name={name} id={id} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{name}</p>
            <p className="truncate text-xs text-ink-500">{student?.email}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={LogOut} className="mt-3 w-full" onClick={logOut}>
          登出
        </Button>
      </div>
    )
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-full bg-fill py-1 pr-3 pl-1 text-[13px] font-medium text-ink-800"
        aria-label="帳號"
      >
        <Avatar name={name} id={id} size="sm" />
        <span className="max-w-24 truncate">{name}</span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        description={student?.email}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} className="h-11 md:h-10">
              取消
            </Button>
            <Button icon={LogOut} onClick={logOut} className="h-11 md:h-10">
              登出
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">登出後，下次需要用 Email 和密碼登入。</p>
      </Modal>
    </>
  )
}

function DemoRoleSwitcher({ placement }: { placement: Placement }) {
  const { data, actions } = useData()
  const { session, signIn, signOut } = useSession()
  const navigate = useNavigate()
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [role, setRole] = useState<Role>(session?.role ?? 'coach')
  const [studentId, setStudentId] = useState(session?.studentId ?? DEFAULT_DEMO_STUDENT_ID)

  const student = data.students.find((s) => s.id === session?.studentId)
  const isCoach = session?.role !== 'student'
  const displayName = isCoach ? data.coach.name : (student?.name ?? '學員')
  const displayId = isCoach ? data.coach.id : (student?.id ?? 'x')

  const openSwitcher = () => {
    setRole(session?.role ?? 'coach')
    setStudentId(session?.studentId && data.students.some((s) => s.id === session.studentId) ? session.studentId : data.students[0]?.id)
    setOpen(true)
  }

  const apply = async () => {
    if (role === 'student' && !data.students.some((s) => s.id === studentId)) {
      notify('請選擇要檢視的學員', 'error')
      return
    }
    const name = data.students.find((s) => s.id === studentId)?.name
    if (isApiMode) {
      // Backend mode: switching identity is a real (demo) sign-in as that user.
      try {
        signIn(await demoLogin(role, role === 'student' ? studentId : undefined))
      } catch (e) {
        notify(e instanceof Error ? e.message : '切換失敗', 'error')
        return
      }
    } else {
      signIn({ role, studentId })
    }
    setOpen(false)
    navigate(role === 'coach' ? '/coach' : '/student')
    notify(role === 'coach' ? '已切換為教練身分' : `已切換為學員：${name}`, 'info')
  }

  const reset = async () => {
    actions.resetDemo()
    setConfirmReset(false)
    setOpen(false)
    // The demo student may no longer exist after a reset (e.g. if they were deleted and re-seeded).
    if (session?.role === 'student') {
      if (isApiMode) {
        try {
          signIn(await demoLogin('student', DEFAULT_DEMO_STUDENT_ID))
        } catch (e) {
          notify(e instanceof Error ? e.message : '重設失敗', 'error')
          return
        }
      } else {
        signIn({ role: 'student', studentId: DEFAULT_DEMO_STUDENT_ID })
      }
    }
    navigate(session?.role === 'student' ? '/student' : '/coach')
    notify('示範資料已重設')
  }

  return (
    <>
      {placement === 'sidebar' ? (
        <div className="rounded-xl bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_0.5px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2.5">
            <Avatar name={displayName} id={displayId} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{displayName}</p>
              <p className="text-xs text-ink-500">{isCoach ? '教練' : '學員'}・示範模式</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={ArrowLeftRight} className="mt-3 w-full" onClick={openSwitcher}>
            切換示範身分
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openSwitcher}
          className="flex h-9 items-center gap-2 rounded-full bg-fill py-1 pr-3 pl-1 text-[13px] font-medium text-ink-800"
          aria-label="切換示範身分"
        >
          <Avatar name={displayName} id={displayId} size="sm" />
          <span className="max-w-24 truncate">{isCoach ? '教練' : displayName}</span>
          <ArrowLeftRight className="size-3.5 text-ink-400" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="示範身分切換"
        description={isApiMode ? '以示範帳號重新登入為其他身分，資料來自伺服器。' : '此為示範版本，無需登入。切換身分以測試教練與學員的不同介面。'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} className="h-11 md:h-10">
              取消
            </Button>
            <Button onClick={() => void apply()} className="h-11 md:h-10">
              套用
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-700">身分</p>
            <Segmented
              label="身分"
              value={role}
              onChange={setRole}
              options={[
                { value: 'coach', label: '教練' },
                { value: 'student', label: '學員' },
              ]}
            />
          </div>
          {role === 'student' && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-700">以哪位學員檢視</p>
              <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {data.students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStudentId(s.id)}
                    aria-pressed={studentId === s.id}
                    className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors ${
                      studentId === s.id ? 'border-accent-600 bg-accent-50' : 'border-line hover:bg-subtle'
                    }`}
                  >
                    <Avatar name={s.name} id={s.id} size="sm" />
                    <span className="flex-1 truncate font-medium text-ink-800">{s.name}</span>
                    {s.status === 'inactive' && <Badge>暫停</Badge>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
              重設示範資料
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={LogOut}
              onClick={() => {
                signOut()
                navigate('/login')
              }}
            >
              {isApiMode ? "登出" : "回到登入頁"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="重設示範資料？"
        description="所有新增的學員、課表、訓練紀錄與堂數異動都會被清除，並重新產生示範資料。"
        confirmLabel="重設"
        tone="danger"
        onConfirm={() => void reset()}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  )
}
