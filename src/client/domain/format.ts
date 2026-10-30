/** Short English counts shared by application feedback and generated documents. */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

/** Keep the existing local numeric timestamp field; never reinterpret historical strings. */
export function noteTimestamp(date = new Date()): string {
    const time = [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':');
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

export function exportTimestamp(date = new Date()): string {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
