
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster as SonnerToaster } from 'react-hot-toast';
import { Toaster } from '@/components/ui/toaster';
import AuthLayout from '@/layouts/AuthLayout';
import PublicLayout from '@/layouts/PublicLayout';
import Login from '@/pages/Login';
import UpdatePassword from '@/pages/UpdatePassword';
import MobileMatchApproval from '@/pages/MobileMatchApproval';
import AppRoutes from '@/AppRoutes';
import DataInitializer from '@/components/DataInitializer';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';
import { ProfileProvider } from '@/context/ProfileContext';
import { AppProvider } from '@/context/AppContext';
import { ColorProvider } from '@/context/ColorContext';
import { ColorViewsProvider } from '@/context/ColorViewsContext';
import { DataProvider } from '@/context/DataContext';
import { InkProvider } from '@/context/InkContext';
import { SubstrateProvider } from '@/context/SubstrateContext';
import { PrinterProvider } from '@/context/PrinterContext';
import { TestchartsProvider } from '@/context/TestchartsContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { WeightingToolsProvider } from '@/context/WeightingToolsContext';
import { RequestCacheProvider } from '@/components/RequestCache';
import { ProgressivePageLoader, PageLoading } from '@/components/ui/page-loading';
import BackgroundPreloader from '@/components/BackgroundPreloader';

import ErrorBoundary from '@/components/ErrorBoundary';
import ProviderSentinel from '@/components/dev/ProviderSentinel';
// Trigger ASTM update with official data
// import './scripts/triggerAstmUpdate';
import ProfileErrorBoundary from '@/components/ProfileErrorBoundary';
import ProfileRecovery from '@/components/ProfileRecovery';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
const ProtectedRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth();

  // While auth is initializing, show a lightweight loader to avoid blank screens
  if (authLoading) {
    return <PageLoading />;
  }

  // If unauthenticated after init, go to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Render children once authenticated
  return children;
};

const canUseRealtime = () => {
  try {
    return typeof window !== 'undefined' && window.isSecureContext && typeof WebSocket !== 'undefined';
  } catch {
    return false;
  }
};

const App = () => {
  const queryClient = useQueryClient();

  // Catch approval tokens at root and redirect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('approveToken');
    
    if (token && window.location.pathname === '/') {
      console.log('🔄 Redirecting from root to /l/approve with token');
      window.location.href = `/l/approve?token=${token}`;
    }
  }, []);

  React.useEffect(() => {
    if (!canUseRealtime()) {
      console.warn('[App] Realtime disabled: insecure context or WebSocket unavailable.');
      return;
    }

    let rtChannel;
    let pgChannel;

    try {
      rtChannel = supabase
        .channel('global-match-updates')
        .on('broadcast', { event: 'match-state-updated' }, (payload) => {
          
          try {
            queryClient.invalidateQueries({ queryKey: ['match-requests'] });
            const id = payload?.payload?.match_request_id;
            if (id) {
              queryClient.invalidateQueries({ queryKey: ['match-request-details', id] });
            }
          } catch (e) {
            console.warn('[App] Invalidation error (broadcast):', e);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('[App] Failed to subscribe to broadcast channel:', e);
    }

    try {
      pgChannel = supabase
        .channel('match-measurements-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'match_measurements' },
          (payload) => {
            try {
              queryClient.invalidateQueries({ queryKey: ['match-requests'] });
              const id = payload?.new?.match_request_id || payload?.old?.match_request_id;
              if (id) {
                queryClient.invalidateQueries({ queryKey: ['match-request-details', id] });
              }
            } catch (e) {
              console.warn('[App] Invalidation error (pg):', e);
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[App] Failed to subscribe to postgres channel:', e);
    }

    return () => {
      try { if (rtChannel) supabase.removeChannel(rtChannel); } catch {}
      try { if (pgChannel) supabase.removeChannel(pgChannel); } catch {}
    };
  }, [queryClient]);

  const debugOverlay = (new URLSearchParams(window.location.search).get('debug') === '1');
  const isHealth = typeof window !== 'undefined' && window.location.pathname.startsWith('/health');

  if (isHealth) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/health" element={<div className="p-4">OK</div>} />
        </Routes>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {debugOverlay && (
        <div style={{position:'fixed', top:8, left:8, zIndex:9999, background:'rgba(0,0,0,0.6)', color:'#fff', padding:'6px 10px', borderRadius:6, fontSize:12}}>
          App shell mounted
        </div>
      )}
      
      {/* Unified routing with provider stack */}
      <ProviderSentinel name="ProfileProvider">
        <ProfileProvider>
          <ProviderSentinel name="NotificationsProvider">
            <NotificationsProvider>
              <ProviderSentinel name="AppProvider">
                <AppProvider>
                  <ProviderSentinel name="ColorProvider">
                    <ColorProvider>
                      <ColorViewsProvider>
                        <BackgroundPreloader />
                        <ProviderSentinel name="DataProvider">
                          <DataProvider>
                            <ProviderSentinel name="InkProvider">
                              <InkProvider>
                                <ProviderSentinel name="SubstrateProvider">
                                  <SubstrateProvider>
                                    <ProviderSentinel name="PrinterProvider">
                                      <PrinterProvider>
                                        <ProviderSentinel name="TestchartsProvider">
                                          <TestchartsProvider>
                                            <ProviderSentinel name="WeightingToolsProvider">
                                              <WeightingToolsProvider>
                                                <Routes>
                                                  {/* Public routes - no auth required */}
                                                  <Route element={<PublicLayout />}>
                                                    <Route path="/login" element={<Login />} />
                                                    <Route path="/update-password" element={<UpdatePassword />} />
                                                    <Route path="/approve" element={<MobileMatchApproval />} />
                                                    <Route path="/l/approve" element={<MobileMatchApproval />} />
                                                  </Route>

                                                  {/* Protected routes - auth required */}
                                                  <Route
                                                    path="/*"
                                                    element={
                                                      <ProtectedRoute>
                                                        <ProfileErrorBoundary>
                                                          <ProfileRecovery>
                                                            <AuthLayout>
                                                              <Suspense fallback={<PageLoading />}>
                                                                <AppRoutes />
                                                              </Suspense>
                                                            </AuthLayout>
                                                          </ProfileRecovery>
                                                        </ProfileErrorBoundary>
                                                      </ProtectedRoute>
                                                    }
                                                  />
                                                </Routes>
                                                <SonnerToaster />
                                                <Toaster />
                                              </WeightingToolsProvider>
                                            </ProviderSentinel>
                                          </TestchartsProvider>
                                        </ProviderSentinel>
                                      </PrinterProvider>
                                    </ProviderSentinel>
                                  </SubstrateProvider>
                                </ProviderSentinel>
                              </InkProvider>
                            </ProviderSentinel>
                          </DataProvider>
                        </ProviderSentinel>
                      </ColorViewsProvider>
                    </ColorProvider>
                  </ProviderSentinel>
                </AppProvider>
              </ProviderSentinel>
            </NotificationsProvider>
          </ProviderSentinel>
        </ProfileProvider>
      </ProviderSentinel>
    </ErrorBoundary>
  );
};

export default App;
