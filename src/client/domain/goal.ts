export interface GoalOrigin { sourcePage: number; sectionId: string; chapter: string }
export interface Goal {
    id: string;
    parentId: string | null;
    text: string;
    origin: GoalOrigin | null;
    createdAt: string;
    updatedAt: string;
}
export interface GoalLink { goalId: string; annotationId: string }
export interface BookGoalState { bookId: string; goals: Goal[]; links: GoalLink[] }
export type GoalBackupState = Omit<BookGoalState, 'links'> & { links?: GoalLink[] };
export interface GoalDraft { id: string; parentId: string | null; text: string; origin: GoalOrigin | null }
