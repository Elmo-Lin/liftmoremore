import { Compass } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Primitives'
import { homePath } from '../lib/roles'
import { useSession } from '../store/contexts'

export function NotFoundPage() {
  const { session } = useSession()
  const home = !session ? '/' : homePath(session.role)
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <EmptyState
        icon={Compass}
        title="找不到這個頁面"
        description="網址可能有誤，或此頁面已不存在。"
        action={<ButtonLink to={home}>回到首頁</ButtonLink>}
      />
    </div>
  )
}
