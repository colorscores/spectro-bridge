import { vi } from 'vitest'

// Mock Supabase client
export const mockSupabase = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({ 
      data: { 
        session: { 
          user: { id: 'mock-user-id', email: 'test@example.com' } 
        } 
      }, 
      error: null 
    })),
    getUser: vi.fn(() => Promise.resolve({ 
      data: { 
        user: { id: 'mock-user-id', email: 'test@example.com' } 
      }, 
      error: null 
    })),
    signIn: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn()
    })),
    subscribe: vi.fn(),
    unsubscribe: vi.fn()
  })),
  removeChannel: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
      download: vi.fn(() => Promise.resolve({ data: null, error: null })),
      remove: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }
}

// Mock the Supabase client module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}))

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: mockSupabase
}))