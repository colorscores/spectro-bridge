// Auth debugging utilities
import { supabase } from '@/integrations/supabase/client';

export const debugAuthState = () => {
  console.log('🔍 === AUTH DEBUG REPORT ===');
  
  // Check localStorage for auth tokens
  const authKeys = Object.keys(localStorage).filter(k => 
    k.includes('supabase') || k.includes('sb-') || k.includes('sb_')
  );
  
  console.log('🔍 Auth-related localStorage keys:', authKeys);
  
  authKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          const expiresAt = parsed.expires_at ? new Date(parsed.expires_at * 1000) : null;
          const now = new Date();
          const timeToExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : null;
          
          console.log(`🔍 ${key}:`, {
            hasAccessToken: !!parsed.access_token,
            hasRefreshToken: !!parsed.refresh_token,
            expiresAt,
            isExpired: parsed.expires_at ? Date.now() > parsed.expires_at * 1000 : null,
            timeToExpiryMinutes: timeToExpiry ? Math.round(timeToExpiry / 60000) : null,
            refreshToken: parsed.refresh_token ? parsed.refresh_token.substring(0, 20) + '...' : null
          });
        } catch {
          console.log(`🔍 ${key}: (raw)`, value.substring(0, 100));
        }
      }
    } catch (error) {
      console.log(`🔍 Error reading ${key}:`, error);
    }
  });
  
  // Check current session with enhanced debugging
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    const expiresAt = session?.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();
    const timeToExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : null;
    
    console.log('🔍 Current session state:', {
      hasSession: !!session,
      error: error?.message,
      userId: session?.user?.id,
      email: session?.user?.email,
      expiresAt,
      isExpired: session?.expires_at ? Date.now() > session.expires_at * 1000 : null,
      timeToExpiryMinutes: timeToExpiry ? Math.round(timeToExpiry / 60000) : null,
      providerToken: session?.provider_token ? 'present' : 'none',
      refreshToken: session?.refresh_token ? session.refresh_token.substring(0, 20) + '...' : null
    });
  }).catch(error => {
    console.error('🔍 Session fetch error:', error);
  });
  
  console.log('🔍 === END AUTH DEBUG ===');
};

export const forceAuthCleanup = () => {
  console.log('🧹 === FORCE AUTH CLEANUP ===');
  
  // Remove all auth-related keys
  Object.keys(localStorage).forEach((key) => {
    if (key.includes('supabase') || key.includes('sb-') || key.includes('sb_')) {
      console.log('🧹 Removing:', key);
      localStorage.removeItem(key);
    }
  });
  
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.includes('supabase') || key.includes('sb-') || key.includes('sb_')) {
      console.log('🧹 Removing from sessionStorage:', key);
      sessionStorage.removeItem(key);
    }
  });
  
  // Force sign out
  supabase.auth.signOut({ scope: 'global' }).then(() => {
    console.log('🧹 Force sign out complete');
    window.location.href = '/login';
  });
  
  console.log('🧹 === CLEANUP COMPLETE ===');
};

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.debugAuth = debugAuthState;
  window.forceAuthCleanup = forceAuthCleanup;
}