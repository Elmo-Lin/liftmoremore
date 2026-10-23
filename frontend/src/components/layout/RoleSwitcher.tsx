import { ArrowLeftRight, Building2, CreditCard, LogOut, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { enterLocalDemo, exitLocalDemo, isApiMode, isLocalDemo } from '../../api/client'
import { demoHome, demoPersonaOf, demoPersonaTitle, demoSession, type DemoPersona } from '../../data/mock'
import { isCoachRole, ROLE_LABEL } from '../../lib/roles'
import { useData, useSession, useToast } from '../../store/contexts'
import { selectIsStudio } from '../../store/selectors'
import { Button } from '../ui/Button'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { Avatar } from '../ui/Primitives'
import { DemoPersonaList } from './DemoPersonas'

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
  const goBilling = () => {
    setOpen(false)
    navigate('/coach/billing')
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
        {studioLink || data.billing ? (
          <div className="space-y-2">
            {studioLink && (
              <Button variant="secondary" icon={Building2} className="h-11 w-full" onClick={goStudio}>
                {studioLink}
              </Button>
            )}
            {data.billing && (
              <Button variant="secondary" icon={CreditCard} className="h-11 w-full" onClick={goBilling}>
                方案與付款
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-600">登出後，下次需要用 Email 或 Google 登入。</p>
        )}
      </Modal>
    </>
  )
}

/** Offline demo: switch between the six demo identities (each switch reloads into its workspace); reset or leave. */
function DemoRoleSwitcher({ placement }: { placement: Placement }) {
  const { data, actions } = useData()
  const { session, signOut } = useSession()
  const navigate = useNavigate()
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const persona = demoPersonaOf(session)
  const student = data.students.find((s) => s.id === session?.studentId)
  const isCoach = isCoachRole(session?.role)
  const displayName = isCoach ? data.coach.name : (student?.name ?? '學員')
  const displayId = isCoach ? data.coach.id : (student?.id ?? 'x')

  const pick = (p: DemoPersona) => {
    if (p === persona) return setOpen(false)
    if (!enterLocalDemo(demoSession(p), demoHome(p))) notify('此瀏覽器無法儲存示範資料', 'error')
  }

  const reset = () => {
    actions.resetDemo()
    setConfirmReset(false)
    setOpen(false)
    navigate(demoHome(persona))
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
              <p className="truncate text-xs text-ink-500">{demoPersonaTitle(persona)}・示範模式</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={ArrowLeftRight} className="mt-3 w-full" onClick={() => setOpen(true)}>
            切換示範身分
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-2 rounded-full bg-fill py-1 pr-3 pl-1 text-[13px] font-medium text-ink-800"
          aria-label="切換示範身分"
        >
          <Avatar name={displayName} id={displayId} size="sm" />
          <span className="max-w-24 truncate">{displayName}</span>
          <ArrowLeftRight className="size-3.5 text-ink-400" />
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="示範身分切換" description="此為示範版本，無需登入。工作室、自由教練與自主訓練是三份各自獨立的資料。">
        <DemoPersonaList current={persona} onPick={pick} />
        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
            重設這份示範資料
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
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="重設示範資料？"
        description="這份示範資料中新增的學員、課程、訓練計畫、訓練紀錄與堂數異動都會被清除，並重新產生。"
        confirmLabel="重設"
        tone="danger"
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  )
}
