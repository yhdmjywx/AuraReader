import type { AppElements } from '../../app/elements.js';
import { marginGeometry } from '../layout/marginNotesLayout.js';

export function positionGoals(elements: AppElements, mode: string): boolean {
    const { goalPanel: panel, workspaceContainer: workspace, bookPaper: paper } = elements;
    if (!panel || !workspace || !paper) return false;
    const geometry = marginGeometry(workspace.clientWidth, 'single');
    const width = Math.min(260, geometry.readingLeft - 40 - 24);
    const visible = mode === 'single' && width >= 200;
    panel.hidden = !visible;
    if (visible) {
        panel.style.left = `${geometry.readingLeft - 40 - width}px`; panel.style.width = `${width}px`;
        const style = workspace.ownerDocument.defaultView?.getComputedStyle(paper);
        panel.style.color = style?.getPropertyValue('--bg-paper-text').trim() || style?.color || '';
    }
    return visible;
}
