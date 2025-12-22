export type UsageEntry = {
    tag: string;
    props?: Record<string, unknown>;
};
export declare function registerUsage(tag: string, props?: Record<string, unknown>): void;
export declare function clearUsage(): void;
export declare function getUsageSnapshot(): UsageEntry[];
export declare function registerTheme(name: string, defs?: Record<string, unknown>): void;
export declare function setCurrentTheme(name: string): void;
export declare function getThemePayload(): {
    current: string | null;
    themes: Record<string, any>;
};
export declare function getThemes(): Record<string, any>;
export declare function resetThemes(): void;
