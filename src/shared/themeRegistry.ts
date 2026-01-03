// Lightweight theme/usage registry used by default HookApp wrappers.
// Keeps styling optional for hosts while still enabling CSS/JSON outputs.
export type UsageEntry = { tag: string; props?: Record<string, unknown> }

const usage: UsageEntry[] = []
const themes: Record<string, any> = {}
let currentTheme: string | null = null

export function registerUsage(tag: string, props?: Record<string, unknown>): void {
    usage.push({ tag, props })
}

export function clearUsage(): void {
    usage.length = 0
}

export function getUsageSnapshot(): UsageEntry[] {
    return [...usage]
}

export function registerTheme(name: string, defs?: Record<string, unknown>): void {
    themes[name] = defs || {}
}

export function setCurrentTheme(name: string): void {
    currentTheme = name
}

export function getThemePayload(): { current: string | null; themes: Record<string, any> } {
    return { current: currentTheme, themes: { ...themes } }
}

export function getThemes(): Record<string, any> {
    return { ...themes }
}

export function resetThemes(): void {
    currentTheme = null
    Object.keys(themes).forEach(k => delete themes[k])
}
