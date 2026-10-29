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
            <DialogTitle>选择需要备份的图书</DialogTitle><DialogDescription>每本书生成一个独立文件。</DialogDescription>
            <Button id="btn-close-backup-modal" className="ui-dialog-close" size="icon" aria-label="关闭备份选择">×</Button>
            <div className="ui-backup-select-all"><Button id="btn-select-all-backup" size="sm">全选</Button><Button id="btn-deselect-all-backup" size="sm">取消全选</Button></div>
            <div id="backup-book-checkbox-list" className="ui-backup-list" />
            <label className="ui-backup-options"><Input type="checkbox" id="chk-backup-include-notes" defaultChecked />包含所选图书的划线与随笔笔记</label>
            <div className="ui-dialog-actions"><Button id="btn-cancel-backup-modal">取消</Button>
                <Button id="btn-confirm-export-backup" variant="default"><i className="ri-download-2-line" aria-hidden="true" />按书分别导出 (.aurabackup)</Button>
            </div>
        </DialogContent>
    </Dialog>;
}
