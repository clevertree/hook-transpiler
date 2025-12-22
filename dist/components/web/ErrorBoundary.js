import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = props.initialError
            ? { hasError: true, error: props.initialError }
            : { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        this.setState({ info });
        console.error('[ErrorBoundary] Caught render error:', error, info);
    }
    componentDidUpdate(prevProps) {
        if (this.props.initialError && this.props.initialError !== prevProps.initialError) {
            this.setState({ hasError: true, error: this.props.initialError });
        }
        if (this.state.hasError && this.props.onElement) {
            // Register elements if error is displayed
            const { onElement } = this.props;
            onElement('div', { style: { padding: '2rem', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#991b1b', maxWidth: '56rem' } });
            onElement('h3', { style: { marginTop: 0, fontSize: '1.125rem', fontWeight: 'bold' } });
        }
    }
    componentDidMount() {
        if (this.state.hasError && this.props.onElement) {
            this.props.onElement('div', { style: { padding: '2rem', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#991b1b', maxWidth: '56rem' } });
        }
    }
    render() {
        if (this.state.hasError) {
            const error = this.state.error ?? this.props.initialError;
            const message = typeof error === 'string' ? error : (error?.message || String(error));
            const stack = error?.stack || this.state.info?.componentStack || '';
            const version = globalThis.__hook_transpiler_version || 'unknown';
            const title = this.props.initialError
                ? 'Hook transpiler failed to initialize'
                : 'Render Error';
            const severityHint = this.props.initialError
                ? 'The async WASM loader failed before render was attempted. JSX transpilation will be unavailable until the issue is resolved.'
                : 'An error occurred while rendering the component tree.';
            const lineMatch = message.match(/line (\d+)|:(\d+)/) || stack.match(/line (\d+)|:(\d+)/);
            const lineNum = lineMatch ? (lineMatch[1] || lineMatch[2]) : null;
            return (_jsxs("div", { style: { padding: '2rem', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#991b1b', maxWidth: '56rem' }, children: [_jsx("h3", { style: { marginTop: 0, fontSize: '1.125rem', fontWeight: 'bold' }, children: title }), _jsx("p", { style: { fontWeight: '600', fontSize: '1rem' }, children: message }), _jsx("p", { style: { fontSize: '0.875rem', lineHeight: '1.625', opacity: 0.8 }, children: severityHint }), _jsxs("p", { style: { fontSize: '0.875rem', opacity: 0.8 }, children: ["Hook Transpiler v", version] }), lineNum && (_jsxs("div", { style: { marginTop: '0.5rem', fontSize: '0.875rem', backgroundColor: '#fecaca', padding: '0.5rem', borderRadius: '0.25rem' }, children: ["Error Location: Line ", lineNum] })), stack && (_jsxs("details", { style: { marginTop: '1rem' }, children: [_jsxs("summary", { style: { cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }, children: ["Stack Trace (", stack.split('\n').length, " lines)"] }), _jsx("pre", { style: { marginTop: '0.5rem', fontSize: '0.75rem', maxHeight: '24rem', overflow: 'auto', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(127, 29, 29, 0.2)', padding: '0.75rem', borderRadius: '0.25rem', fontFamily: 'monospace' }, children: stack })] }))] }));
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
//# sourceMappingURL=ErrorBoundary.js.map