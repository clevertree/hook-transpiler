import React from 'react';
export interface HookRendererProps {
    host: string;
    hookPath?: string;
    onElement?: (tag: string, props: any) => void;
    requestRender?: () => void;
    renderCssIntoDom?: () => void;
    startAutoSync?: (interval?: number) => void;
    stopAutoSync?: () => void;
    registerTheme?: (name: string, defs?: any) => void;
    loadThemesFromYamlUrl?: (url: string) => Promise<void>;
    markdownOverrides?: Record<string, React.ComponentType<any>>;
}
export declare const HookRenderer: React.FC<HookRendererProps>;
export default HookRenderer;
