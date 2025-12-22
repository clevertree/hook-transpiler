const usage = [];
const themes = {};
let currentTheme = null;
export function registerUsage(tag, props) {
    usage.push({ tag, props });
}
export function clearUsage() {
    usage.length = 0;
}
export function getUsageSnapshot() {
    return [...usage];
}
export function registerTheme(name, defs) {
    themes[name] = defs || {};
}
export function setCurrentTheme(name) {
    currentTheme = name;
}
export function getThemePayload() {
    return { current: currentTheme, themes: { ...themes } };
}
export function getThemes() {
    return { ...themes };
}
export function resetThemes() {
    currentTheme = null;
    Object.keys(themes).forEach(k => delete themes[k]);
}
//# sourceMappingURL=themeRegistry.js.map