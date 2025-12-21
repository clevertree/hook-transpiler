import type { TurboModule } from 'react-native';
export interface Spec extends TurboModule {
    transpile(code: string, filename: string): Promise<string>;
    getVersion(): string;
    initialize(): Promise<void>;
}
declare const _default: any;
export default _default;
