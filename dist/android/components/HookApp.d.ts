import React from 'react';
import { type HookRendererProps } from './HookRenderer.js';
type Status = {
    loading: boolean;
    error?: string | null;
    hookPath: string;
};
export interface HookAppProps extends Partial<HookRendererProps> {
    host?: string;
    hookPath?: string;
    onStatus?: (status: Status) => void;
}
export declare const HookApp: React.FC<HookAppProps>;
export default HookApp;
