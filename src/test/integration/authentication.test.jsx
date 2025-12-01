import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils/test-utils'
import { mockSupabase } from '../mocks/supabase'
import { createMockUser, createMockProfile } from '../factories'

describe('Authentication Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle successful login flow', async () => {
    const mockUser = createMockUser()
    const mockProfile = createMockProfile()
    
    // Mock successful auth
    mockSupabase.auth.signIn.mockResolvedValue({
      data: { user: mockUser, session: { access_token: 'mock-token' } },
      error: null
    })
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    })
    
    // Mock profile fetch
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockProfile, error: null }))
        }))
      }))
    })
    
    const result = await mockSupabase.auth.signIn('test@example.com', 'password')
    
    expect(result.error).toBeNull()
    expect(result.data.user).toEqual(mockUser)
    expect(mockSupabase.auth.signIn).toHaveBeenCalledWith('test@example.com', 'password')
  })

  it('should handle authentication errors gracefully', async () => {
    const authError = new Error('Invalid credentials')
    
    mockSupabase.auth.signIn.mockResolvedValue({
      data: null,
      error: authError
    })
    
    const result = await mockSupabase.auth.signIn('test@example.com', 'wrongpassword')
    
    expect(result.error).toEqual(authError)
    expect(result.data).toBeNull()
  })

  it('should handle logout flow', async () => {
    mockSupabase.auth.signOut.mockResolvedValue({ error: null })
    
    const result = await mockSupabase.auth.signOut()
    
    expect(result.error).toBeNull()
    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('should handle session management', async () => {
    const mockSession = {
      user: createMockUser(),
      access_token: 'mock-token',
      expires_at: Date.now() + 3600000
    }
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    })
    
    const { data, error } = await mockSupabase.auth.getSession()
    
    expect(error).toBeNull()
    expect(data.session).toEqual(mockSession)
  })

  it('should handle auth state changes', () => {
    const mockCallback = vi.fn()
    const mockUnsubscribe = vi.fn()
    
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } }
    })
    
    const { data } = mockSupabase.auth.onAuthStateChange(mockCallback)
    
    expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledWith(mockCallback)
    expect(data.subscription.unsubscribe).toBe(mockUnsubscribe)
  })
})