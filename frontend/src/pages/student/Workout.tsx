import { PageHeader } from '../../components/ui/Primitives'
import { WorkoutLogger } from '../../components/workout/WorkoutLogger'
import { useCurrentStudent } from '../../store/selectors'

export function StudentWorkoutPage() {
  const student = useCurrentStudent()!
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="自主訓練" description="記錄自己練的內容，教練也看得到你的努力。自主訓練不會扣除教練課堂數。" />
      <WorkoutLogger key={student.id} mode="student" fixedStudentId={student.id} />
    </div>
  )
}
