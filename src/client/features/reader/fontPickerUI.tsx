import { Button } from '../../components/ui/button.js';
import { renderSurface } from '../../components/ui/renderSurface.js';

type Choice = { kind: string; id?: string; family?: string };
type Font = { id?: string; name: string };
export function renderCurrentFont(host: HTMLElement, choice: Choice, font: Font) {
    host.hidden = !['system', 'imported'].includes(choice.kind);
    renderSurface(host, host.hidden ? null : <>
        <p className="font-group-label">当前字体</p>
        <Button className="font-option" role="menuitemradio" aria-checked="true"
            data-system-family={choice.kind === 'system' ? choice.family : undefined}
            data-imported-font={choice.kind === 'imported' ? choice.id : undefined}>{font.name}</Button>
    </>);
}
export function renderFontBrowser(host: HTMLElement, { imported, recent, systemFamilies, choice, query }:
    { imported: Font[]; recent: string[]; systemFamilies: string[]; choice: Choice; query: string }) {
    const local = [...new Set([...recent, ...systemFamilies])].sort((a, b) => a.localeCompare(b));
    const groups = [
        { label: '已导入', kind: 'imported', fonts: imported.filter(font => font.name.toLocaleLowerCase().includes(query)) },
        { label: '本机字体', kind: 'system', fonts: local.filter(name => name.toLocaleLowerCase().includes(query)).map(name => ({ name, id: undefined })) },
    ];
    renderSurface(host, <>{groups.filter(group => group.fonts.length).map(group => <div key={group.kind}>
        <p className="font-group-label">{group.label}</p>
        {group.fonts.map(font => <Button key={font.id || font.name} className="font-option" role="menuitemradio"
            data-imported-font={group.kind === 'imported' ? font.id : undefined}
            data-system-family={group.kind === 'system' ? font.name : undefined}
            aria-checked={choice.kind === group.kind && (group.kind === 'imported' ? choice.id === font.id : choice.family === font.name)}>{font.name}</Button>)}
    </div>)}{!groups.some(group => group.fonts.length) && <p className="font-empty">{query ? '没有匹配的字体' : '读取本机字体，或导入字体文件'}</p>}</>);
}
