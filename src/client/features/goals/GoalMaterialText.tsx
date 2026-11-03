import type { Annotation } from '../../domain/annotation.js';

/** Shared content for linked materials on Home, the sidebar and the full Goal page. */
export function GoalMaterialText({ annotation }: { annotation: Annotation }) {
    return <>
        {annotation.quote.trim() && <span className="goal-material-quote">{annotation.quote}</span>}
        {annotation.comment.trim() && <span className="goal-material-comment">{annotation.comment}</span>}
    </>;
}
