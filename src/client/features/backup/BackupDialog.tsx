import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';

/** The export controller retains file operations; this React dialog owns focus and presentation. */
export function BackupDialog() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const show = () => setOpen(true), hide = () => setOpen(false);
        document.addEventListener('aura:backup-open', show); document.addEventListener('aura:backup-close', hide);
        return () => { document.removeEventListener('aura:backup-open', show); document.removeEventListener('aura:backup-close', hide); };
    }, []);
    return <Dialog open={open} onOpenChange={value => {
        setOpen(value); if (!value) document.getElementById('backup-select-modal')?.classList.remove('active');
    }}>
        <DialogContent id="backup-select-modal" keepMounted finalFocus={() => document.getElementById('btn-workspace-settings')}>
            <DialogTitle>Select books to back up</DialogTitle><DialogDescription>One file per book.</DialogDescription>
            <Button id="btn-close-backup-modal" className="ui-dialog-close" size="icon" aria-label="Close backup selection">×</Button>
            <div className="ui-backup-select-all"><Button id="btn-select-all-backup" size="sm">Select all</Button><Button id="btn-deselect-all-backup" size="sm">Deselect all</Button></div>
            <div id="backup-book-checkbox-list" className="ui-backup-list" />
            <label className="ui-backup-options"><Input type="checkbox" id="chk-backup-include-notes" defaultChecked />Include highlights and notes</label>
            <div className="ui-dialog-actions"><Button id="btn-cancel-backup-modal">Cancel</Button>
                <Button id="btn-confirm-export-backup" variant="default"><i className="ri-download-2-line" aria-hidden="true" />Export books (.aurabackup)</Button>
            </div>
        </DialogContent>
    </Dialog>;
}
