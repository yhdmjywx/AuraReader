import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Button } from '../../components/ui/button.js';
import { ActionIcon } from '../../components/ui/action-icon.js';
import { Input } from '../../components/ui/input.js';

/** Global controls keep their existing IDs and controller bindings. */
export function WorkspaceSettings() {
    const [open, setOpen] = useState(false);
    return <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger render={<Button id="btn-workspace-settings" size="lg" className="workspace-settings" />} aria-label="Settings" title="Settings">
            <ActionIcon name="settings" /><span>Settings</span>
        </Popover.Trigger>
        <Popover.Portal keepMounted>
            <Popover.Positioner side="top" align="start" sideOffset={8} collisionPadding={12} className="ui-floating-positioner">
                <Popover.Popup id="workspace-settings-panel" data-slot="dialog-content" className="workspace-settings-panel" aria-label="Settings">
                    <Popover.Title>Settings</Popover.Title>
                    <div className="workspace-theme-row"><span>Appearance</span>
                        <Button id="btn-theme-toggle" className="btn btn-icon-sm" type="button" title="Toggle theme"><i className="ri-sun-line" /></Button>
                    </div>
                    <hr />
                    <h3 className="export-section-title">Backup and restore</h3>
                    <Button id="btn-export-full-backup" className="export-menu-action export-backup-action" type="button" onClick={() => setOpen(false)}>
                        <i className="ri-archive-line" aria-hidden="true" /><span className="export-action-label">Back up books</span><span className="export-extension">.aurabackup</span>
                    </Button>
                    <Button id="btn-import-full-backup" className="export-menu-action export-backup-action" type="button" onClick={() => setOpen(false)}>
                        <i className="ri-upload-line" aria-hidden="true" /><span className="export-action-label">Restore books</span>
                    </Button>
                    <p className="export-panel-note">One file/book · Highlights + notes</p>
                    <Input type="file" id="backup-file-input" accept=".aurabackup,.json" hidden />
                </Popover.Popup>
            </Popover.Positioner>
        </Popover.Portal>
    </Popover.Root>;
}
