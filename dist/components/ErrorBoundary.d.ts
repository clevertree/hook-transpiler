import React from 'react';
type ErrorBoundaryProps = {
    children: React.ReactNode;
    initialError?: Error | string | null;
    onElement?: (tag: string, props: any) => void;
};
type ErrorBoundaryState = {
    hasError: boolean;
    error?: any;
    info?: any;
};
export declare class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState;
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(error: any): ErrorBoundaryState;
    componentDidCatch(error: any, info: any): void;
    componentDidUpdate(prevProps: ErrorBoundaryProps): void;
    componentDidMount(): void;
    render(): string | number | boolean | Iterable<React.ReactNode> | import("react/jsx-runtime").JSX.Element | null | undefined;
}
export default ErrorBoundary;
