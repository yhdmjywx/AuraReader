export interface GoalOrigin { sourcePage: number | null; sectionId: string; chapter: string; bookId?: string }
export interface Goal {
    id: string;
    parentId: string | null;
    text: string;
    origin: GoalOrigin | null;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    /** A marker on a branch root; descendants inherit visibility, not this field. */
    archivedAt?: string;
    deletedAt?: string;
}
export interface GoalLink { goalId: string; annotationId: string }
export interface BookGoalState { bookId: string; goals: Goal[]; links: GoalLink[] }
export type GoalBackupState = Omit<BookGoalState, 'links'> & { links?: GoalLink[] };
export interface GoalDraft { id: string; parentId: string | null; text: string; origin: GoalOrigin | null }
export interface GoalContentMeta { order?: number; response?: { markedAt: string; sequence: number } }
export interface GoalInput extends GoalContentMeta { id: string; goalId: string; text: string; createdAt: string; updatedAt: string }
export interface GoalInputDraft { id: string; goalId: string; text: string }
export interface GoalSourceLink extends GoalLink, GoalContentMeta { bookId: string; generation: string }
export interface GoalBookLink { goalId: string; bookId: string; generation: string }
export interface GoalLibraryState { goals: Goal[]; links: GoalSourceLink[]; bookLinks?: GoalBookLink[]; formatVersion?: 2; contentSequence?: number; inputs?: GoalInput[] }
export interface GoalGraphBackup { goals: Goal[]; links?: GoalSourceLink[]; bookLinks?: GoalBookLink[] }
