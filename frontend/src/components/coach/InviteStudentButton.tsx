import { Check, Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { createInvite } from '../../api/auth'
import { isApiMode } from '../../api/client'
import { BRAND } from '../../config/brand'
import { formatDate } from '../../lib/format'
import { useSession, useToast } from '../../store/contexts'
import type { Student } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

/** Backend mode only: generate a one-time code the student uses to set a password. */
export function InviteStudentButton({ student }: { student: Student }) {
  const { session } = useSession()
  const notify = useToast()
  const [invite, setInvite] = useState<{ inviteCode: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!isApiMode) return null

  const generate = async () => {
    if (!session?.token) return
    setBusy(true)
    try {
      setInvite(await createInvite(student.id, session.token))
    } catch (e) {
      notify(e instanceof Error ? e.message : '無法產生邀請碼', 'error')
    } finally {
      setBusy(false)
    }
  }

  const message = invite
    ? `嗨 ${student.name}，請到 ${BRAND.name} 登入頁選擇「邀請碼」，輸入 ${invite.inviteCode} 並設定密碼，就能看到課表、堂數與訓練紀錄。`
    : ''

  return (
    <>
      <Button variant="secondary" icon={KeyRound} onClick={() => void generate()} disabled={busy}>
        {student.activated ? '已啟用帳號' : '邀請登入'}
      </Button>
      <Modal
        open={!!invite}
        onClose={() => setInvite(null)}
        title={`邀請 ${student.name} 登入`}
        description="學員在登入頁選擇「邀請碼」，輸入下方代碼並設定密碼即可啟用帳號。"
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
        {invite && (
          <div className="space-y-3">
            <p className="num rounded-xl bg-raised py-5 text-center text-[34px] tracking-[0.2em] text-ink-900 select-all">{invite.inviteCode}</p>
            <p className="text-center text-[13px] text-ink-500">有效期限至 {formatDate(invite.expiresAt, { year: true })}，使用一次後失效</p>
            <p className="rounded-lg bg-fill px-3 py-2.5 text-[13px] leading-relaxed text-ink-700">{message}</p>
          </div>
        )}
      </Modal>
    </>
  )
}
