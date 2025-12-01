import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestchartsProvider, useTestchartsData } from '@/context/TestchartsContext'
import { mockSupabase } from '../mocks/supabase'
import { createMockProfile, createMockTestChart } from '../factories'

// Mock the ProfileContext
const mockProfileContext = {
  profile: createMockProfile(),
  loading: false
}

vi.mock('@/context/ProfileContext', () => ({
  useProfile: () => mockProfileContext
}))

describe('TestchartsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: [createMockTestChart()],
            error: null
          }))
        }))
      }))
    })
  })

  it('provides test charts data when profile is loaded', async () => {
    const wrapper = ({ children }) => (
      <TestchartsProvider>{children}</TestchartsProvider>
    )

    const { result } = renderHook(() => useTestchartsData(), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.testcharts).toHaveLength(1)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.refetch).toBe('function')
  })

  it('handles loading state correctly', () => {
    mockProfileContext.loading = true

    const wrapper = ({ children }) => (
      <TestchartsProvider>{children}</TestchartsProvider>
    )

    const { result } = renderHook(() => useTestchartsData(), { wrapper })

    expect(result.current.loading).toBe(true)
    expect(result.current.testcharts).toEqual([])
  })

  it('handles error state when fetch fails', async () => {
    const mockError = new Error('Failed to fetch test charts')
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: null,
            error: mockError
          }))
        }))
      }))
    })

    const wrapper = ({ children }) => (
      <TestchartsProvider>{children}</TestchartsProvider>
    )

    const { result } = renderHook(() => useTestchartsData(), { wrapper })

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError)
    })

    expect(result.current.testcharts).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useTestchartsData())
    }).toThrow('useTestchartsData must be used within a TestchartsProvider')
  })

  it('refetches data when refetch is called', async () => {
    const wrapper = ({ children }) => (
      <TestchartsProvider>{children}</TestchartsProvider>
    )

    const { result } = renderHook(() => useTestchartsData(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Clear previous calls
    vi.clearAllMocks()

    // Call refetch
    result.current.refetch()

    // Should make a new API call
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('test_charts')
    })
  })
})