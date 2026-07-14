import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-xl font-semibold text-slate-800">
              We are having trouble accessing the scanner.
            </p>
            <p className="text-slate-600">Please proceed to the reception desk.</p>
            <button
              type="button"
              className="rounded-xl bg-sky-600 px-6 py-3 text-white"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
