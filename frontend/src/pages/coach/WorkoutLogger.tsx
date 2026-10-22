import { PageHeader } from '../../components/ui/Primitives'
import { WorkoutLogger } from '../../components/workout/WorkoutLogger'

export function CoachWorkoutLoggerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="記錄訓練" description="記錄與扣堂是分開的：完成訓練後，會再詢問是否扣除一堂課。" />
      <WorkoutLogger mode="coach" />
    </div>
  )
}
