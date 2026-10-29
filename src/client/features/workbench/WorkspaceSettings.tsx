import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';

/** Global controls keep their existing IDs and controller bindings. */
export function WorkspaceSettings() {
    const [open, setOpen] = useState(false);
    return <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger render={<Button id="btn-workspace-settings" className="workspace-settings" />} aria-label="设置与资料管理">
            <i className="ri-settings-3-line" aria-hidden="true" /><span>设置与资料管理</span>
        </Popover.Trigger>
        <Popover.Portal keepMounted>
            <Popover.Positioner side="top" align="start" sideOffset={8} collisionPadding={12} className="ui-floating-positioner">
                <Popover.Popup id="workspace-settings-panel" data-slot="dialog-content" className="workspace-settings-panel" aria-label="设置与资料管理">
                    <Popover.Title>设置与资料管理</Popover.Title>
                    <div className="workspace-theme-row"><span>应用明暗</span>
                        <Button id="btn-theme-toggle" className="btn btn-icon-sm" type="button" title="切换主题"><i className="ri-sun-line" /></Button>
                    </div>
                    <hr />
                    <h3 className="export-section-title">书籍备份与恢复</h3>
                    <Button id="btn-export-full-backup" className="export-menu-action export-backup-action" type="button" onClick={() => setOpen(false)}>
                        <i className="ri-archive-line" aria-hidden="true" /><span className="export-action-label">导出书籍备份</span><span className="export-extension">.aurabackup</span>
                    </Button>
                    <Button id="btn-import-full-backup" className="export-menu-action export-backup-action" type="button" onClick={() => setOpen(false)}>
                        <i className="ri-upload-line" aria-hidden="true" /><span className="export-action-label">从备份恢复书籍</span>
                    </Button>
                    <p className="export-panel-note">每本书一个备份文件 · 包含高亮与笔记</p>
                    <Input type="file" id="backup-file-input" accept=".aurabackup,.json" hidden />
                </Popover.Popup>
            </Popover.Positioner>
        </Popover.Portal>
    </Popover.Root>;
}
