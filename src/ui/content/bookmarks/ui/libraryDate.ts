import { getEffectiveLocale } from '../../components/i18n';

export function libraryDate(timestamp: number): HTMLTimeElement | null {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return null;
    const locale = getEffectiveLocale() === 'zh_CN' ? 'zh-CN' : 'en-US';
    const time = document.createElement('time');
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
    return time;
}
