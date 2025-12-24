interface FileRendererProps {
    content: string;
    contentType: string;
    onElement?: (tag: string, props: any) => void;
}
export declare function FileRenderer({ content, contentType, onElement }: FileRendererProps): import("react/jsx-runtime").JSX.Element;
export {};
