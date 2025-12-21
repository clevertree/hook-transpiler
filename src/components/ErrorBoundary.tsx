import React from 'react'

type ErrorBoundaryProps = {
  children: React.ReactNode
  initialError?: Error | string | null
  onElement?: (tag: string, props: any) => void
}

type ErrorBoundaryState = { hasError: boolean; error?: any; info?: any }

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = props.initialError
      ? { hasError: true, error: props.initialError }
      : { hasError: false }
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    this.setState({ info })
    console.error('[ErrorBoundary] Caught render error:', error, info)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.props.initialError && this.props.initialError !== prevProps.initialError) {
      this.setState({ hasError: true, error: this.props.initialError })
    }

    if (this.state.hasError && this.props.onElement) {
       // Register elements if error is displayed
       const { onElement } = this.props
       onElement('div', { style: { padding: '2rem', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#991b1b', maxWidth: '56rem' } })
       onElement('h3', { style: { marginTop: 0, fontSize: '1.125rem', fontWeight: 'bold' } })
    }
  }

  componentDidMount() {
    if (this.state.hasError && this.props.onElement) {
        this.props.onElement('div', { style: { padding: '2rem', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#991b1b', maxWidth: '56rem' } })
    }
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error ?? this.props.initialError
      const message = typeof error === 'string' ? error : (error?.message || String(error))
      const stack = (error as any)?.stack || this.state.info?.componentStack || ''
      const version = (globalThis as any).__hook_transpiler_version || 'unknown'
      const title = this.props.initialError
        ? 'Hook transpiler failed to initialize'
        : 'Render Error'
      const severityHint = this.props.initialError
        ? 'The async WASM loader failed before render was attempted. JSX transpilation will be unavailable until the issue is resolved.'
        : 'An error occurred while rendering the component tree.'

      const lineMatch = message.match(/line (\d+)|:(\d+)/) || stack.match(/line (\d+)|:(\d+)/)
      const lineNum = lineMatch ? (lineMatch[1] || lineMatch[2]) : null

      return (
        <div style={{ padding: '2rem', backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#991b1b', maxWidth: '56rem' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.125rem', fontWeight: 'bold' }}>{title}</h3>
          <p style={{ fontWeight: '600', fontSize: '1rem' }}>{message}</p>
          <p style={{ fontSize: '0.875rem', lineHeight: '1.625', opacity: 0.8 }}>{severityHint}</p>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>Hook Transpiler v{version}</p>

          {lineNum && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', backgroundColor: '#fecaca', padding: '0.5rem', borderRadius: '0.25rem' }}>
              Error Location: Line {lineNum}
            </div>
          )}

          {stack && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}>
                Stack Trace ({stack.split('\n').length} lines)
              </summary>
              <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem', maxHeight: '24rem', overflow: 'auto', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(127, 29, 29, 0.2)', padding: '0.75rem', borderRadius: '0.25rem', fontFamily: 'monospace' }}>
                {stack}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
