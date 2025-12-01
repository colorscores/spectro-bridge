import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
// import '@/lib/authDebug'; // Commented out to prevent module loading issues

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // More conservative cleanup function - only remove problematic keys
  const cleanupAuthState = useCallback(() => {
    try {
      console.log('🧹 Conservative auth cleanup...');
      
      // Only remove specific problematic keys, preserve session data
      const keysToRemove = [
        'supabase.auth.debug',
        'supabase.auth.lock',
        'supabase.auth.network-error'
      ];
      
      Object.keys(localStorage).forEach((key) => {
        // Only remove explicitly problematic keys or expired tokens
        if (keysToRemove.some(k => key.includes(k))) {
          console.log('🧹 Removing problematic key:', key);
          localStorage.removeItem(key);
        }
      });
      
      // Clear navigation memory from session storage
      try {
        sessionStorage.removeItem('nav_visited_groups');
        console.log('🧹 Cleared navigation memory');
      } catch (e) {
        console.warn('Could not clear navigation memory:', e);
      }
      
      console.log('🧹 Conservative cleanup complete');
    } catch (error) {
      console.warn('Could not clean auth state:', error);
    }
  }, []);

  // Fetch user profile data - SIMPLIFIED to avoid race conditions
  const fetchProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return null;
    }
    
    try {
      console.log('👤 Fetching profile for user:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
        return null;
      }
      if (!data) {
        setProfile(null);
        return null;
      }
      
      console.log('👤 Profile loaded:', data);
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Exception fetching profile:', error);
      setProfile(null);
      return null;
    }
  }, []);

  // Initialize auth state with robust error handling and session gating
  useEffect(() => {
    let mounted = true;
    let authSubscription = null;
    let sessionCheckAttempts = 0;
    const MAX_SESSION_ATTEMPTS = 3;
    
    const initializeAuth = async () => {
      if (!mounted) return;
      
      try {
        console.log('🔐 Initializing auth state...');
        setLoading(true);
        
        // Enhanced session validation with domain check
        const currentDomain = window.location.hostname;
        console.log('🔐 Current domain:', currentDomain);
        
        // Simplified session fetch with timeout
        const attemptSessionFetch = async () => {
          try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Session fetch timeout')), 1200)
            );
            
            const { data: { session: currentSession }, error } = await Promise.race([
              sessionPromise, 
              timeoutPromise
            ]);
            
            return { session: currentSession, error };
          } catch (fetchError) {
            console.warn('🔐 Session fetch failed:', fetchError);
            // Return null session on timeout to allow graceful fallback
            return { session: null, error: fetchError };
          }
        };
        
        const { session: currentSession, error } = await attemptSessionFetch();
        
        if (!mounted) return;
        
        // Handle timeout with immediate redirect
        if (!currentSession && error?.message?.includes('timeout')) {
          console.error('🔐 Session fetch timed out, forcing redirect to login');
          window.location.replace('/login');
          return; // Stop execution
        }
        
        // Enhanced session validation
        let validSession = null;
        if (currentSession) {
          const isExpired = currentSession.expires_at && currentSession.expires_at * 1000 < Date.now();
          const hasValidUser = currentSession.user && currentSession.user.id;
          
          if (!isExpired && hasValidUser) {
            validSession = currentSession;
            console.log('🔐 Valid session found:', { 
              userId: currentSession.user.id,
              expiresAt: new Date(currentSession.expires_at * 1000).toISOString()
            });
          } else {
            console.warn('🔐 Invalid session detected:', { isExpired, hasValidUser });
            // Clear invalid session
            await supabase.auth.signOut({ scope: 'global' });
          }
        }
        
        console.log('🔐 Session fetch result:', { 
          hasSession: !!validSession, 
          error: error?.message,
          userId: validSession?.user?.id
        });
        
        setSession(validSession);
        const currentUser = validSession?.user ?? null;
        setUser(currentUser);
        setProfile(null); // Always reset profile and let ProfileContext handle it
        setLoading(false);
        console.log('🔐 Auth initialized:', { 
          hasSession: !!validSession, 
          userId: currentUser?.id,
          email: currentUser?.email 
        });
      } catch (error) {
        console.error('Exception initializing auth:', error);
        if (mounted) {
          // On timeout or error, try to recover gracefully
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          
          // Clean up problematic auth state
          cleanupAuthState();
        }
      }
    };

    // Initialize auth state FIRST (Fix #1: Correct order)
    initializeAuth();

    // THEN set up auth state listener with enhanced error handling
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('🔐 Auth state change:', { 
            event, 
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id,
            sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none'
          });
          
          if (!mounted) return;
          
          try {
            // Enhanced session validation before state updates
            let validSession = null;
            if (session) {
              const isExpired = session.expires_at && session.expires_at * 1000 < Date.now();
              const hasValidUser = session.user && session.user.id;
              
              if (!isExpired && hasValidUser) {
                validSession = session;
              } else {
                console.warn('🔐 Invalid session in auth change:', { isExpired, hasValidUser });
              }
            }
            
            // Synchronous state updates only - NO async calls here
            setSession(validSession);
            const currentUser = validSession?.user ?? null;
            setUser(currentUser);
            
            // Handle specific auth events with improved reliability
            if (event === 'SIGNED_OUT') {
              console.log('👋 User signed out, cleaning up...');
              setProfile(null);
              setIsPasswordRecovery(false);
              
              // Clear ALL caches immediately on logout
              console.log('🗑️ Clearing all caches on logout...');
              
              // 1. Clear RequestCache
              if (typeof window !== 'undefined' && window.requestCacheInstance) {
                console.log('  - Clearing RequestCache');
                window.requestCacheInstance.clearCache();
              }
              
              // 2. Clear ProfileContext localStorage cache
              if (typeof window !== 'undefined' && window.localStorage) {
                console.log('  - Clearing ProfileContext localStorage cache');
                const keys = Object.keys(window.localStorage);
                keys.forEach(key => {
                  if (key.startsWith('profile_cache_')) {
                    window.localStorage.removeItem(key);
                  }
                });
              }
              
              // 3. Clear all React Query cache
              if (typeof window !== 'undefined' && window.queryClient) {
                console.log('  - Clearing all React Query cache');
                window.queryClient.clear();
              }
              
              console.log('✅ All caches cleared');
              
              // Notify other contexts (e.g., AppContext) to reset their state
              try {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('auth-signed-out'));
                }
              } catch {}
              
              // Defer cleanup to avoid blocking the auth state change
              setTimeout(() => cleanupAuthState(), 0);
            } else if (event === 'TOKEN_REFRESHED') {
              console.log('🔄 Token refreshed successfully at', new Date().toISOString());
              // Enhanced token refresh validation
              if (validSession?.expires_at) {
                const expiresAt = new Date(validSession.expires_at * 1000);
                const timeUntilExpiry = expiresAt.getTime() - Date.now();
                console.log('🔄 New token expires at:', expiresAt.toISOString(), 
                  `(${Math.round(timeUntilExpiry / 60000)} minutes from now)`);
                
                // If token will expire soon, log warning
                if (timeUntilExpiry < 10 * 60 * 1000) { // Less than 10 minutes
                  console.warn('⚠️ Token will expire soon after refresh');
                }
              }
            } else if (event === 'SIGNED_IN') {
              console.log('👋 User signed in successfully');
              console.log('🔍 Session details:', { 
                userId: validSession?.user?.id,
                email: validSession?.user?.email,
                expiresAt: validSession?.expires_at ? new Date(validSession.expires_at * 1000).toISOString() : 'none'
              });
              setIsPasswordRecovery(false);
              // Enhanced sign-in validation
              if (validSession?.expires_at) {
                const expiresAt = new Date(validSession.expires_at * 1000);
                console.log('👋 Session expires at:', expiresAt.toISOString());
              }
              // Cache clearing is now handled by organizationId change in AppContext
            } else if (event === 'PASSWORD_RECOVERY') {
              setIsPasswordRecovery(true);
            } else if (event === 'USER_UPDATED') {
              console.log('👤 User data updated');
              setIsPasswordRecovery(false);
            }
            
            // Reset profile - let ProfileContext handle profile loading
            setProfile(null);
            setLoading(false);
          } catch (error) {
            console.error('Error in auth state change handler:', error);
            // Try to recover gracefully
            if (mounted) {
              setSession(null);
              setUser(null);
              setProfile(null);
              setLoading(false);
            }
          }
        }
      );
      
      authSubscription = subscription;
    } catch (error) {
      console.error('Failed to set up auth listener:', error);
      // Fallback: still try to initialize
      if (mounted) {
        setLoading(false);
      }
    }

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (authSubscription) {
        try {
          authSubscription.unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing from auth changes:', error);
        }
      }
    };
  }, [cleanupAuthState]);

  // Session debugging and monitoring - removed aggressive polling
  useEffect(() => {
    // Add session expiration monitoring
    const checkSessionExpiry = () => {
      if (session?.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        const timeToExpiry = expiresAt.getTime() - now.getTime();
        
        console.log('📅 Session monitoring:', {
          expiresAt: expiresAt.toISOString(),
          timeToExpiryMinutes: Math.round(timeToExpiry / 60000),
          isExpired: timeToExpiry <= 0
        });
        
        // Log when session is about to expire (within 5 minutes)
        if (timeToExpiry > 0 && timeToExpiry < 5 * 60 * 1000) {
          console.warn('⚠️ Session expiring soon:', Math.round(timeToExpiry / 60000), 'minutes');
        }
      }
    };

    // Check session expiry every 2 minutes (less aggressive)
    const interval = setInterval(checkSessionExpiry, 2 * 60 * 1000);
    
    // Initial check
    checkSessionExpiry();

    return () => {
      clearInterval(interval);
    };
  }, [session]);

  const signUp = useCallback(async (email, password, options = {}) => {
    try {
      console.log('📝 Signing up user:', email);
      
      // Include email redirect for better auth flow
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          ...options
        }
      });
      
      if (error) {
        console.error('Sign up error:', error.message);
        toast({ 
          variant: "destructive", 
          title: "Sign Up Failed", 
          description: error.message || "Something went wrong" 
        });
      } else {
        toast({ 
          title: "Sign Up Successful", 
          description: "Please check your email to confirm your account." 
        });
      }
      
      return { data, error };
    } catch (error) {
      console.error('Sign up exception:', error);
      return { error };
    }
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    try {
      // Normalize email to lowercase for consistency
      const normalizedEmail = email.toLowerCase();
      console.log('🔑 Signing in user:', normalizedEmail);
      
      // NUCLEAR FIX: Force global sign out BEFORE sign in to eliminate token pollution
      console.log('🧹 Clearing ALL auth tokens before login...');
      await supabase.auth.signOut({ scope: 'global' });
      
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now sign in with a completely clean slate
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        console.error('Sign in error:', error.message);
        toast({ 
          variant: "destructive", 
          title: "Sign In Failed", 
          description: error.message || "Something went wrong" 
        });
      } else if (data.user) {
        console.log('✅ Sign in successful for:', data.user.email);
        
        // Post-login verification: ensure JWT matches expected user (case-insensitive)
        const { data: { user: verifyUser } } = await supabase.auth.getUser();
        
        if (verifyUser.email.toLowerCase() !== normalizedEmail) {
          console.error('🚨 POST-LOGIN TOKEN MISMATCH!', {
            expected: normalizedEmail,
            expectedOriginal: email,
            got: verifyUser.email
          });
          
          // If mismatch detected, force another sign out and fail
          await supabase.auth.signOut({ scope: 'global' });
          
          toast({ 
            variant: "destructive", 
            title: "Login Failed", 
            description: "Session verification failed. Please try again." 
          });
          
          return { data: null, error: { message: 'Token mismatch after login' } };
        }
        
        console.log('✅ Post-login verification passed:', verifyUser.email);
        
        toast({ 
          title: "Welcome back!", 
          description: "You have been signed in successfully." 
        });
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      }

      return { data, error };
    } catch (error) {
      console.error('Sign in exception:', error);
      toast({ 
        variant: "destructive", 
        title: "Sign In Failed", 
        description: "An unexpected error occurred" 
      });
      return { error };
    }
  }, [cleanupAuthState, toast]);

  const signOut = useCallback(async () => {
    try {
      console.log('👋 Signing out user...');
      
      // Global logout: clear tokens across all tabs and domains
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('Sign out error:', error);
        toast({ 
          variant: "destructive", 
          title: "Sign Out Failed", 
          description: error.message || "Something went wrong" 
        });
      } else {
        toast({ 
          title: "Signed out", 
          description: "You have been signed out successfully." 
        });
      }
      
      // Clean up after successful logout
      cleanupAuthState();
      
      // Navigate to login
      setTimeout(() => {
        navigate('/login');
      }, 100);
      
      return { error };
    } catch (error) {
      console.error('Sign out exception:', error);
      // Force cleanup and redirect even on error
      cleanupAuthState();
      navigate('/login');
      return { error };
    }
  }, [cleanupAuthState, toast, navigate]);

  const resetPasswordForEmail = useCallback(async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://updates.colorscores.com/update-password`,
      });
      
      if (error) {
        toast({ 
          variant: "destructive", 
          title: "Password Reset Failed", 
          description: error.message 
        });
      } else {
        toast({ 
          title: "Password Reset Email Sent", 
          description: "Check your email for a link to reset your password." 
        });
      }
      
      return { error };
    } catch (error) {
      console.error('Password reset exception:', error);
      return { error };
    }
  }, [toast]);

  const updateUserPassword = useCallback(async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
        toast({ 
          variant: "destructive", 
          title: "Password Update Failed", 
          description: error.message 
        });
      } else {
        toast({ 
          title: "Password Updated Successfully", 
          description: "You can now log in with your new password." 
        });
      }
      
      return { data, error };
    } catch (error) {
      console.error('Password update exception:', error);
      return { error };
    }
  }, [toast]);

  // Memoize the context value for performance
  const value = useMemo(() => ({
    user,
    session,
    profile,
    loading,
    isPasswordRecovery,
    signUp,
    signIn,
    signOut,
    fetchProfile: () => fetchProfile(user), // Keep for compatibility but discourage use
    resetPasswordForEmail,
    updateUserPassword,
    cleanupAuthState,
  }), [
    user, 
    session, 
    profile, 
    loading, 
    isPasswordRecovery, 
    signUp, 
    signIn, 
    signOut, 
    fetchProfile, 
    resetPasswordForEmail, 
    updateUserPassword,
    cleanupAuthState
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
