import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, User, WifiOff } from 'lucide-react';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProfileRecovery = ({ children }) => {
  const { user } = useAuth();
  const { profile, loading, error, retryCount, refreshProfile } = useProfile();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [autoRetryCount, setAutoRetryCount] = useState(0);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-retry when coming back online if there was an error
      if (error && user && !loading && autoRetryCount < 3) {
        setAutoRetryCount(prev => prev + 1);
        refreshProfile();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error, user, loading, refreshProfile, autoRetryCount]);

  // Reset auto retry count when profile loads successfully
  useEffect(() => {
    if (profile) {
      setAutoRetryCount(0);
    }
  }, [profile]);

  const handleRetry = async () => {
    if (!isOnline) {
      return; // Don't retry if offline
    }
    setIsRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setIsRetrying(false);
    }
  };

  // Show loading state
  if (loading) {
    return children;
  }

  // If we have a user but no profile and there's an error, show recovery UI
  if (user && !profile && (error || retryCount > 0)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              {!isOnline ? <WifiOff className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              {!isOnline ? 'Connection Issue' : 'Profile Recovery'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">Signed in as:</div>
                <div className="text-muted-foreground">{user.email}</div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {!isOnline 
                ? 'You appear to be offline. Please check your internet connection.'
                : 'Your profile data couldn\'t be loaded. This might be a temporary issue.'
              }
              {retryCount > 0 && ` (Attempt ${retryCount}/3)`}
            </p>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {error.message || 'Unknown error occurred'}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleRetry} 
                disabled={isRetrying || !isOnline}
                className="flex-1"
              >
                {isRetrying ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {isRetrying ? 'Retrying...' : isOnline ? 'Try Again' : 'Offline'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/login'}
                className="flex-1"
              >
                Sign Out
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              {!isOnline 
                ? 'Will automatically retry when connection is restored.'
                : 'If this issue persists, please contact your administrator.'
              }
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal case - render children
  return children;
};

export default ProfileRecovery;