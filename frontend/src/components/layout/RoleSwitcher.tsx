import { ArrowLeftRight, Building2, LogOut, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { exitLocalDemo, isApiMode, isLocalDemo } from '../../api/client'
import { DEFAULT_DEMO_STUDENT_ID, DEMO_COACH_ROLE } from '../../data/mock'
import { isCoachRole, ROLE_LABEL } from '../../lib/roles'
import { useData, useSession, useToast } from '../../store/contexts'
import { selectIsStudio } from '../../store/selectors'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Form'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { Avatar, Badge } from '../ui/Primitives'

type Placement = 'sidebar' | 'topbar'

/** Real accounts get an account menu; the offline demo gets a role switcher. */
export function RoleSwitcher({ placement }: { placement: Placement }) {
  return isApiMode ? <AccountMenu placement={placement} /> : <DemoRoleSwitcher placement={placement} />
}

/** Who is signed in (and where), the studio page for coaches who run one or could, and sign-out. */
function AccountMenu({ placement }: { placement: Placement }) {
  const { data } = useData()
  const { session, signOut } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const role = session?.role
  const asCoach = isCoachRole(role)
  const student = data.students.find((s) => s.id === session?.studentId)
  const name = (asCoach ? data.coach.name : student?.name) || session?.name || ''
  const id = asCoach ? data.coach.id : (student?.id ?? 'x')
  const email = asCoach ? data.coach.email : student?.email
  const inStudio = selectIsStudio(data)
  const where = asCoach && inStudio ? data.studio?.name : undefined
  const label = role === 'coach' && !inStudio ? '自由教練' : role ? ROLE_LABEL[role] : ''
  const studioLink = role === 'owner' ? '工作室管理' : role === 'coach' && !inStudio ? '升級為工作室' : null
  const logOut = () => {
    signOut()
    navigate('/login')
  }
  const goStudio = () => {
    setOpen(false)
    navigate('/coach/studio')
  }

  if (placement === 'sidebar') {
    return (
      <div className="rounded-xl bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_0.5px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2.5">
          <Avatar name={name} id={id} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{name}</p>
            <p className="truncate text-xs text-ink-500">{[label, where].filter(Boolean).join('・')}</p>
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
        description={[label, where, email].filter(Boolean).join('・')}
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
        {studioLink ? (
          <Button variant="secondary" icon={Building2} className="h-11 w-full" onClick={goStudio}>
            {studioLink}
          </Button>
        ) : (
          <p className="text-sm text-ink-600">登出後，下次需要用 Email 和密碼登入。</p>
        )}
      </Modal>
    </>
  )
}

/** Offline demo: switch between the demo coach (a studio owner) and any student; reset the data. */
function DemoRoleSwitcher({ placement }: { placement: Placement }) {
  const { data, actions } = useData()
  const { session, signIn, signOut } = useSession()
  const navigate = useNavigate()
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [role, setRole] = useState<'coach' | 'student'>(isCoachRole(session?.role) ? 'coach' : 'student')
  const [studentId, setStudentId] = useState(session?.studentId ?? DEFAULT_DEMO_STUDENT_ID)

  const student = data.students.find((s) => s.id === session?.studentId)
  const isCoach = isCoachRole(session?.role)
  const displayName = isCoach ? data.coach.name : (student?.name ?? '學員')
  const displayId = isCoach ? data.coach.id : (student?.id ?? 'x')

  const openSwitcher = () => {
    setRole(isCoachRole(session?.role) ? 'coach' : 'student')
    setStudentId(session?.studentId && data.students.some((s) => s.id === session.studentId) ? session.studentId : data.students[0]?.id)
    setOpen(true)
  }

  const apply = () => {
    if (role === 'student' && !data.students.some((s) => s.id === studentId)) {
      notify('請選擇要檢視的學員', 'error')
      return
    }
    const name = data.students.find((s) => s.id === studentId)?.name
    signIn({ role: role === 'coach' ? DEMO_COACH_ROLE : 'student', studentId })
    setOpen(false)
    navigate(role === 'coach' ? '/coach' : '/student')
    notify(role === 'coach' ? '已切換為教練身分' : `已切換為學員：${name}`, 'info')
  }

  const reset = () => {
    actions.resetDemo()
    setConfirmReset(false)
    setOpen(false)
    // The demo student may no longer exist after a reset (e.g. if they were deleted and re-seeded).
    if (session?.role === 'student') signIn({ role: 'student', studentId: DEFAULT_DEMO_STUDENT_ID })
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
        description="此為示範版本，無需登入。切換身分以測試教練與學員的不同介面。"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} className="h-11 md:h-10">
              取消
            </Button>
            <Button onClick={apply} className="h-11 md:h-10">
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
                if (isLocalDemo) return exitLocalDemo()
                signOut()
                navigate('/login')
              }}
            >
              {isLocalDemo ? '離開示範' : '回到登入頁'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="重設示範資料？"
        description="所有新增的學員、課程、訓練計畫、訓練紀錄與堂數異動都會被清除，並重新產生示範資料。"
        confirmLabel="重設"
        tone="danger"
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  )
}
