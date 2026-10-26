export interface GoalOrigin { sourcePage: number | null; sectionId: string; chapter: string; bookId?: string }
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
export interface GoalSourceLink extends GoalLink { bookId: string; generation: string }
export interface GoalLibraryState { goals: Goal[]; links: GoalSourceLink[] }
export interface GoalGraphBackup { goals: Goal[]; links?: GoalSourceLink[] }
