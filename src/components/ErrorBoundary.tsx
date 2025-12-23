'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { maskPII } from '../lib/dataMasking';
import { logError } from '../lib/logger';
import { trackError } from '../lib/telemetry/appInsights';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Store errorInfo in state for rendering
    this.setState({ errorInfo });
    
    // Track error in Application Insights
    trackError({
      error,
      properties: {
        componentName: this.props.componentName || 'ErrorBoundary',
        componentStack: errorInfo.componentStack || 'No component stack',
        errorName: error.name,
      },
      severityLevel: 'Error',
    });
    
    // Log error with our secure logger (if available)
    try {
      if (typeof logError === 'function') {
        logError(
          `ErrorBoundary caught an error in ${this.props.componentName || 'unknown component'}`,
          error,
          {
            componentName: this.props.componentName || 'ErrorBoundary',
            errorMessage: typeof maskPII === 'function' ? maskPII(error.message || '') : error.message,
            componentStack: errorInfo.componentStack ? 
              (typeof maskPII === 'function' ? maskPII(errorInfo.componentStack) : errorInfo.componentStack) : 
              'No component stack',
            errorName: error.name
          }
        );
      }
    } catch (loggerError) {
      // Fallback: if logger itself fails, use console as last resort
      // This is acceptable since it's a critical error handling path
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ErrorBoundary] Logger failed:', loggerError);
      }
    }
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }
  
  // Reset error state when props change if the resetOnPropsChange flag is set
  componentDidUpdate(prevProps: Props) {
    if (
      this.state.hasError && 
      this.props.resetOnPropsChange && 
      this.props.children !== prevProps.children
    ) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    }
  }
  
  // Allow manual reset from parent components
  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-lg p-6 shadow-xl">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-10 w-10 text-red-500" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>
            
            <h2 className="text-xl font-bold mb-2 text-center">Something went wrong</h2>
            <p className="mb-4 text-slate-300 text-center">
              The application encountered an error. We&apos;ve logged this issue and are working to fix it.
            </p>
            
            <div className="bg-slate-700/50 p-4 rounded-lg mb-4">
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-blue-400 mb-2">Technical details</summary>
                <pre className="bg-slate-900 p-3 rounded text-xs overflow-auto max-h-48 text-slate-300">
                  {this.state.error?.message || 'Unknown error'}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:\n'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            </div>
            
            <div className="flex flex-col space-y-3">
              <button 
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                onClick={this.resetErrorBoundary}
              >
                Try Again
              </button>
              
              <button 
                className="w-full py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 font-medium"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
