declare module '@swc/wasm-web';
declare module '*.wasm' {
    const content: string;
    export default content;
}