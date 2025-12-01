import React from 'react';
import { useProfile } from '@/context/ProfileContext';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
// import useDataMigration from '@/hooks/useDataMigration';

const DataInitializer = ({ children }) => {
  console.log('🔄 DataInitializer rendering...');
  
  const { profile, loading: profileLoading, user, session } = useProfile();

  // Enhanced session validation
  const hasValidSession = session && user && session.expires_at && session.expires_at * 1000 > Date.now();
  const isLoading = profileLoading;

  console.log('🔄 DataInitializer state:', {
    profileLoading,
    hasValidSession,
    hasProfile: !!profile,
    userId: user?.id,
    sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none'
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500" />
          <p className="mt-4 text-lg text-gray-600">Loading your workspace...</p>
          <p className="mt-2 text-sm text-gray-500">
            Auth: {user ? 'Yes' : 'No'} | Session: {hasValidSession ? 'Valid' : 'Invalid'} | Profile: {profile ? 'Yes' : 'No'}
          </p>
        </div>
      </div>
    );
  }
  
  // SESSION GATING: Strict authentication check with session validation
  if (!hasValidSession) {
    console.log('❌ DataInitializer: Invalid session, redirecting to login');
    window.location.href = '/login';
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-orange-500" />
          <p className="mt-4 text-lg text-gray-600">Session expired. Redirecting to login...</p>
        </div>
      </div>
    );
  }
  
  // Profile validation with better error handling
  if (!profile) {
    console.error('❌ DataInitializer: No profile loaded');
    
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-red-500" />
          <p className="mt-4 text-lg text-gray-600">Setting up your profile...</p>
          <p className="mt-2 text-sm text-gray-500">User ID: {user?.id}</p>
        </div>
      </div>
    );
  }

  console.log('✅ DataInitializer: All checks passed, rendering children');
  return children;
};

export default DataInitializer;