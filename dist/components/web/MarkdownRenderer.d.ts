interface MarkdownRendererProps {
    content: string;
    navigate?: (path: string) => void;
    onElement?: (tag: string, props: any) => void;
    overrides?: any;
}
export declare function MarkdownRenderer({ content, navigate, onElement, overrides }: MarkdownRendererProps): import("react/jsx-runtime").JSX.Element;
export {};
