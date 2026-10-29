/* ==========================================================================
   BackupModalUI - Backup Dialog & Multi-Book Export Presentation (Feature Layer)
   Handles backup modal checkbox list rendering, all-select toggling, and dialog visibility.
   ========================================================================== */
import { renderBackupChoices } from './exportChoicesUI.js';

export function renderBackupBookList(elements, books = [], allNotes = []) {
    if (!elements || !elements.backupBookCheckboxList) return;

    renderBackupChoices(elements.backupBookCheckboxList, books, allNotes);
}

export function openBackupModal(elements) {
    if (elements && elements.backupSelectModal) {
        elements.backupSelectModal.classList.add('active');
        elements.backupSelectModal.ownerDocument.dispatchEvent(new Event('aura:backup-open'));
    }
}

export function closeBackupModal(elements) {
    if (elements && elements.backupSelectModal) {
        elements.backupSelectModal.classList.remove('active');
        elements.backupSelectModal.ownerDocument.dispatchEvent(new Event('aura:backup-close'));
    }
}

export function toggleAllCheckboxes(elements, checked) {
    if (!elements || !elements.backupBookCheckboxList) return;
    elements.backupBookCheckboxList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.checked = checked;
    });
}

export function getSelectedBookIds(elements) {
    if (!elements || !elements.backupBookCheckboxList) return [];
    const selected = elements.backupBookCheckboxList.querySelectorAll('.chk-backup-book:checked');
    return Array.from(selected).map(chk => chk.getAttribute('data-id'));
}

export function getIncludeOptions(elements) {
    const includeNotes = elements && elements.chkBackupIncludeNotes ? elements.chkBackupIncludeNotes.checked : true;
    return { includeNotes };
}
