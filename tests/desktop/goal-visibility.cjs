// Runs in the actual Renderer; inspect composited colors and real hit rectangles.
module.exports = function auditGoalVisibility() {
    const parse = value => (value.match(/[\d.]+/g) || []).map(Number);
    const over = (front, back) => {
        const a = front[3] ?? 1;
        return [0, 1, 2].map(i => front[i] * a + back[i] * (1 - a)).concat(1);
    };
    const background = element => {
        if (!element) return [255, 255, 255, 1];
        return over(parse(getComputedStyle(element).backgroundColor), background(element.parentElement));
    };
    const luminance = rgb => {
        const c = rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
    };
    const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
    const results = [];
    for (const e of document.querySelectorAll('#goal-panel button,#goal-panel textarea,.goal-item-source,.goal-empty,#btn-goals,#btn-goal-sidebar,#btn-goal-back,.btn-goal-link,#btn-annotation-goal')) {
        if (!e.getClientRects().length || (e.disabled && !e.classList.contains('is-linked'))) continue;
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        if (s.visibility === 'hidden') continue;
        const name = e.getAttribute('aria-label') || e.textContent || e.className;
        for (let p = e; p; p = p.parentElement) {
            if (Number(getComputedStyle(p).opacity) < .99) throw Error('Faded control: ' + name);
        }
        const bg = background(e), fg = over(parse(s.color), bg), ratio = contrast(fg, bg);
        const minimum = e.textContent.trim() || e.matches('textarea') ? 4.5 : 3;
        if (ratio < minimum) throw Error('Contrast ' + ratio.toFixed(2) + ': ' + name);
        if (e.matches('button') && (r.width < 31.9 || r.height < 31.9)) throw Error('Small target ' + r.width + '×' + r.height + ': ' + name);
        if (e.closest('#goal-panel')) {
            const panel = document.getElementById('goal-panel').getBoundingClientRect();
            if (r.left < panel.left - 1 || r.right > panel.right + 1) throw Error('Horizontal overflow: ' + name);
        }
        results.push({ name: name.slice(0, 80), ratio: Number(ratio.toFixed(2)), width: Math.round(r.width), height: Math.round(r.height), font: s.fontSize });
    }
    const controls = [...document.querySelectorAll('#goal-panel button')].filter(e => !e.disabled && e.getClientRects().length);
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i].getBoundingClientRect(), b = controls[j].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) throw Error('Overlapping Goal targets');
    }
    return results;
};
