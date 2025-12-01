
// Add global error handler to catch initialization errors
window.addEventListener('error', (e) => {
  console.error('🔴 GLOBAL ERROR:', e.error || e.message);
  console.error('🔴 ERROR STACK:', e.error?.stack);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('🔴 UNHANDLED PROMISE REJECTION:', e.reason);
});

console.log('🚀 main.jsx: Starting import phase');

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import StabilizedErrorBoundary from '@/components/StabilizedErrorBoundary';
import { ProfileProvider } from '@/context/ProfileContext';
import '@/index.css';

console.log('🚀 main.jsx: All imports successful');

// Detect duplicate React instances
console.log('[React version]', React.version);
if (typeof window !== 'undefined') {
  if (window.__REACT_SINGLETON__ && window.__REACT_SINGLETON__ !== React) {
    console.warn('[Duplicate React detected] Existing:', window.__REACT_SINGLETON__.version, 'New:', React.version);
  }
  window.__REACT_SINGLETON__ = React;
}

// Conditional debug loading - only load if specifically needed
const debugParam = new URLSearchParams(window.location.search).get('debug');
if (debugParam === '1') {
  import('@/lib/globalErrorDebug.js').catch(() => {});
  import('@/lib/appBootstrap.js').catch(() => {});
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - cache retention (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1, // Only retry once on failure
    },
  },
});

// Make queryClient available globally for auth context
if (typeof window !== 'undefined') {
  window.queryClient = queryClient;
}

// Conditionally enable StrictMode based on debug parameter
const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';
const RootWrapper = isDebugMode ? React.Fragment : React.StrictMode;

// Ensure root element exists
const rootEl = document.getElementById('root') || (() => {
  const el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
  return el;
})();

console.log('Boot: mounting React root'); 
console.log('Boot: DOM ready state:', document.readyState);
console.log('Boot: Root element exists:', !!rootEl);
console.log('Boot: React available:', typeof React);
console.log('Boot: ReactDOM available:', typeof ReactDOM);

console.log('Boot: Rendering App...');
try {
  ReactDOM.createRoot(rootEl).render(
    <RootWrapper>
      <BrowserRouter>
        <HelmetProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StabilizedErrorBoundary title="Application Error" message="The application encountered an error. This may be temporary.">
                <App />
              </StabilizedErrorBoundary>
              <ReactQueryDevtools initialIsOpen={false} />
            </AuthProvider>
          </QueryClientProvider>
        </HelmetProvider>
      </BrowserRouter>
    </RootWrapper>
  );
  console.log('Boot: React render successful!');
} catch (error) {
  console.error('🔴 CRITICAL: Failed to render React app:', error);
  console.error('🔴 ERROR STACK:', error.stack);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: monospace;">
      <h1 style="color: red;">Application Failed to Load</h1>
      <p>Error: ${error.message}</p>
      <pre>${error.stack}</pre>
    </div>
  `;
}
