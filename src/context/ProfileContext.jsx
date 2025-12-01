import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, startTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export const ProfileContext = createContext(undefined);

export const ProfileProvider = ({ children }) => {
  // Consume auth context deterministically
  const { user, session, loading: authLoading } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const isMountedRef = useRef(true);

  // Simplified profile caching
  const PROFILE_CACHE_KEY = 'profile_cache';
  const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  const getCachedProfile = useCallback((userId) => {
    try {
      const cached = localStorage.getItem(`${PROFILE_CACHE_KEY}_${userId}`);
      if (cached) {
        const { profile: cachedProfile, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
          console.log('📄 Using cached profile for user:', userId);
          return cachedProfile;
        }
      }
    } catch (error) {
      console.warn('Failed to read cached profile:', error);
    }
    return null;
  }, []);

  const setCachedProfile = useCallback((userId, profileData) => {
    try {
      localStorage.setItem(`${PROFILE_CACHE_KEY}_${userId}`, JSON.stringify({
        profile: profileData,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to cache profile:', error);
    }
  }, []);

  // Memoize clearProfile to prevent unnecessary re-renders
  const clearProfile = useCallback(() => {
    if (isMountedRef.current) {
      startTransition(() => {
        setProfile(null);
        setError(null);
        setLoading(false);
        setRetryCount(0);
      });
    }
  }, []);

  const createProfileFromUser = useCallback(async (currentUser) => {
    if (!currentUser || !isMountedRef.current) return;

    try {
      const userMetadata = currentUser.user_metadata || {};
      const profileData = {
        id: currentUser.id,
        full_name: userMetadata.full_name || userMetadata.name || currentUser.email?.split('@')[0] || null,
        role: userMetadata.role || 'user',
        organization_id: null
      };
      
      console.log('👤 ProfileContext - Creating profile:', profileData);
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();
        
      if (createError) {
        console.error('ProfileContext - Profile creation failed:', createError);
        startTransition(() => {
          setError(createError);
          // Use fallback profile to prevent infinite loading
          const fallbackProfile = {
            id: currentUser.id,
            full_name: userMetadata.full_name || currentUser.email?.split('@')[0] || 'User',
            role: 'user',
            organization_id: null
          };
          setProfile(fallbackProfile);
        });
      } else if (newProfile && isMountedRef.current) {
        console.log('👤 ProfileContext - Profile created:', newProfile);
        startTransition(() => {
          setProfile(newProfile);
          setError(null);
          setRetryCount(0); // Reset retry count on success
        });
        setCachedProfile(currentUser.id, newProfile);
      }
    } catch (error) {
      console.error('ProfileContext - Exception creating profile:', error);
      if (isMountedRef.current) {
        startTransition(() => {
          setError(error);
        });
      }
    }
  }, [setCachedProfile]);

  // Enhanced profile fetching with session validation
  const fetchProfile = useCallback(async (currentUser) => {
    if (!currentUser || !isMountedRef.current) {
      clearProfile();
      return;
    }

    try {
      startTransition(() => {
        setLoading(true);
        setError(null);
        setRetryCount(prev => prev + 1);
      });

      // Trust AuthProvider's session validation (Fix #3: Remove redundant session check)
      console.log('👤 ProfileContext - Fetching profile for authenticated user:', currentUser.id);
      
      // Try cached profile first
      const cachedProfile = getCachedProfile(currentUser.id);
      if (cachedProfile && isMountedRef.current) {
        console.log('📄 ProfileContext - Using cached profile');
        startTransition(() => {
          setProfile(cachedProfile);
          setLoading(false);
        });
        return; // Don't fetch fresh if cached is available and recent
      }

      // Fetch fresh profile with organization data
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          organization:organizations(
            id,
            name,
            type,
            location,
            default_illuminant,
            default_observer,
            default_astm_table,
            default_delta_e,
            default_measurement_mode,
            logo_url,
            color_libraries_license,
            printer_kiosk_license,
            match_pack_license,
            create_pack_license
          )
        `)
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!isMountedRef.current) return;

      if (error) {
        console.error('ProfileContext - Error fetching profile:', error);
        startTransition(() => {
          setError(error);
          setProfile(null);
        });
      } else if (!data) {
        // No profile found - create one
        await createProfileFromUser(currentUser);
      } else {
        console.log('👤 ProfileContext - Profile loaded:', data);
        startTransition(() => {
          setProfile(data);
          setError(null);
          setRetryCount(0); // Reset retry count on success
        });
        setCachedProfile(currentUser.id, data);
      }
    } catch (error) {
      console.error('ProfileContext - Exception fetching profile:', error);
      if (isMountedRef.current) {
        startTransition(() => {
          setError(error);
          setProfile(null);
        });
      }
    } finally {
      if (isMountedRef.current) {
        startTransition(() => {
          setLoading(false);
        });
      }
    }
  }, [clearProfile, getCachedProfile, setCachedProfile, createProfileFromUser]);

  // Refresh profile function for external use
  const refreshProfile = useCallback(() => {
    if (user && session) {
      fetchProfile(user);
    }
  }, [user, session, fetchProfile]);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log('🔍 ProfileContext - Effect triggered:', { 
      authLoading, 
      user: user?.id, 
      session: !!session, 
      profile: profile?.id,
      sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none'
    });
    
    // SESSION GATING: Don't proceed until auth is fully resolved
    if (authLoading) {
      console.log('ProfileContext - Auth still loading, waiting...');
      return;
    }
    
    if (!isMountedRef.current) return;
    
    // Enhanced session validation
    if (!session || !user) {
      console.log('ProfileContext - No valid session or user, clearing profile');
      clearProfile();
      return;
    }
    
    // Validate session is not expired
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      console.warn('ProfileContext - Session expired, clearing profile');
      clearProfile();
      return;
    }
    
    // Only fetch if we don't have a profile or if the user changed
    if (!profile || profile.id !== user?.id) {
      console.log('ProfileContext - Fetching profile for user:', user.id);
      // Add timeout for profile fetch
      const fetchTimeout = setTimeout(() => {
        console.warn('ProfileContext - Profile fetch timeout, setting fallback');
        if (isMountedRef.current && !profile) {
          startTransition(() => {
            const fallbackProfile = {
              id: user.id,
              full_name: user.email?.split('@')[0] || 'User',
              role: 'user',
              organization_id: null
            };
            setProfile(fallbackProfile);
            setLoading(false);
          });
        }
      }, 4000); // increased to 4s to avoid premature fallback on slower networks
      
      fetchProfile(user).finally(() => {
        clearTimeout(fetchTimeout);
      });
    } else {
      console.log('ProfileContext - Profile already loaded for user:', user.id);
      // Still set loading to false if we have a valid profile
      if (loading) {
        startTransition(() => {
          setLoading(false);
        });
      }
    }
  }, [user, session, authLoading, fetchProfile, clearProfile, profile, loading]);

  // Memoize context value to minimize re-renders of consuming components
  const value = useMemo(() => ({
    profile,
    loading: authLoading || loading,
    error,
    retryCount,
    fetchProfile: refreshProfile,
    refreshProfile,
    user,
    session,
  }), [profile, authLoading, loading, error, retryCount, refreshProfile, user, session]);

  // Emit profile updates for AppProvider
  useEffect(() => {
    const profileData = {
      profile,
      loading: authLoading || loading
    };
    window.dispatchEvent(new CustomEvent('profile-updated', { detail: profileData }));
  }, [profile, authLoading, loading]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    // Return safe defaults instead of throwing error - prevents crashes
    console.warn('useProfile called outside ProfileProvider, returning defaults');
    console.trace('useProfile call stack:'); // Add stack trace to debug
    return {
      profile: null,
      loading: false,
      error: null,
      retryCount: 0,
      fetchProfile: () => {},
      refreshProfile: () => {},
      user: null,
      session: null,
    };
  }
  return context;
};