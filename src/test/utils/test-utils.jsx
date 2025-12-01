import React from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ProfileProvider } from '@/context/ProfileContext'
import { ColorProvider } from '@/context/ColorContext'
import { ColorViewsProvider } from '@/context/ColorViewsContext'
import { AppProvider } from '@/context/AppContext'
import ErrorBoundary from '@/components/ErrorBoundary'

// Create a custom render function that includes providers
function AllTheProviders({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <ProfileProvider>
              <AppProvider>
                <ColorProvider>
                  <ColorViewsProvider>
                    {children}
                  </ColorViewsProvider>
                </ColorProvider>
              </AppProvider>
            </ProfileProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

function customRender(ui, options) {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }