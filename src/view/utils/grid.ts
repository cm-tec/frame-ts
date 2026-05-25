export function niceInterval(range: number, targetCount = 7): number {
    if (range === 0) return 1;
    const raw = range / targetCount;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    if (norm < 1.5) return mag;
    if (norm < 3.5) return 2 * mag;
    if (norm < 7.5) return 5 * mag;
    return 10 * mag;
}

export function formatGridLabel(val: number, interval: number): string {
    const decimals = Math.max(0, -Math.floor(Math.log10(interval)));
    return val.toFixed(decimals);
}
