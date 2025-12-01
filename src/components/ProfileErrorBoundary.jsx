import React, { Component, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ProfileErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Always return hasError: true to prevent re-render flip-flops that break hooks dispatcher
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ProfileErrorBoundary caught an error:', error, errorInfo);
    
    // Check if this is a React 18 suspension error
    const isSuspenseError = error.message?.includes('suspended') || error.name === 'ChunkLoadError';
    
    if (isSuspenseError) {
      console.log('ProfileErrorBoundary: Detected suspension error, handling gracefully');
    }
    
    startTransition(() => {
      this.setState({
        error,
        errorInfo
      });
    });
  }

  handleRetry = () => {
    startTransition(() => {
      this.setState({ hasError: false, error: null, errorInfo: null });
    });
    
    // Force a refresh of the profile context
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      // Avoid immediate reload, try state reset first
      setTimeout(() => {
        if (this.state.hasError) {
          window.location.reload();
        }
      }, 1000);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Profile Loading Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                There was an error loading your profile data. This might be due to a temporary connection issue.
              </p>
              
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} className="flex-1">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/login'}
                  className="flex-1"
                >
                  Sign Out
                </Button>
              </div>

              {this.state.error && (
                <details className="mt-4">
                  <summary className="text-sm font-medium cursor-pointer">Error Details</summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-60">
                    {this.state.error?.toString?.()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ProfileErrorBoundary;