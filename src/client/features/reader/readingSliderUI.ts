export const fontSizeRange = { min: 13, max: 32, step: 1 };
export const lineSpacingRange = { min: 1.2, max: 2.4, step: 0.05 };
export const readingWidthRange = { min: 320, max: 800, step: 40 };
export const indentRange = { min: 0, max: 2, step: 1 };
export const defaultIndent = 1;

export function readingWidthStops(maximum: number, current: number) {
    const { min, step } = readingWidthRange;
    if (maximum <= min) return [maximum];

    // Start at the available width so that a step down still subtracts 40px
    // when the viewport cuts off the regular range between two steps.
    const stops = new Set([min, current]);
    for (let width = maximum; width > min; width -= step) stops.add(width);
    return [...stops].sort((a, b) => a - b);
}

export function showReadingSlider(
    input: HTMLInputElement | null | undefined, readout: HTMLElement | null | undefined,
    value: number, text: string, description: string, unavailable = ''
) {
    const tooltip = unavailable || description;
    if (readout) {
        readout.textContent = text;
        readout.title = tooltip;
    }
    if (!input) return;
    input.valueAsNumber = value;
    const min = Number(input.min), max = Number(input.max);
    input.style.setProperty('--slider-progress', String(max > min ? (input.valueAsNumber - min) / (max - min) : 0));
    input.disabled = !!unavailable;
    input.title = tooltip;
    input.setAttribute('aria-valuetext', description);
}
