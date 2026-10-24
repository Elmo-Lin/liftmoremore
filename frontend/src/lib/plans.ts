import type { TrainingDay, TrainingPlan } from '../types'

/**
 * A plan is one workout menu. It is stored as a single training day; plans saved before menus
 * existed may have several, which read as one list in their order. The menu is named after the plan.
 */
export function planMenu(plan: TrainingPlan): TrainingDay {
  return { id: plan.days[0]?.id ?? `${plan.id}_menu`, name: plan.name, focus: '', exercises: plan.days.flatMap((d) => d.exercises) }
}

/** The plan with its menu as its only day, which is how plans are edited and saved. */
export const asMenuPlan = (plan: TrainingPlan): TrainingPlan => ({ ...plan, days: [planMenu(plan)] })
