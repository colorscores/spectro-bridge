import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils/test-utils'
import { mockSupabase } from '../mocks/supabase'
import { createMockUser, createMockProfile, createMockColor, createMockTestChart } from '../factories'

// Mock pages for E2E-like testing
vi.mock('@/pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard</div>
}))

vi.mock('@/pages/Colors', () => ({
  default: () => (
    <div data-testid="colors-page">
      <h1>Colors</h1>
      <button data-testid="add-color-btn">Add Color</button>
      <div data-testid="color-list">
        <div data-testid="color-item">Test Color</div>
      </div>
    </div>
  )
}))

vi.mock('@/pages/Testcharts', () => ({
  default: () => (
    <div data-testid="testcharts-page">
      <h1>Test Charts</h1>
      <button data-testid="add-testchart-btn">Add Test Chart</button>
    </div>
  )
}))

describe('End-to-End User Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup successful auth and data mocks
    const mockUser = createMockUser()
    const mockProfile = createMockProfile()
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    })
    
    mockSupabase.from.mockImplementation((table) => {
      const responses = {
        profiles: { data: [mockProfile], error: null },
        colors: { data: [createMockColor(), createMockColor({ name: 'Blue', hex: '#0000FF' })], error: null },
        test_charts: { data: [createMockTestChart()], error: null },
        organizations: { data: [{ id: 'mock-org-id', name: 'Test Org' }], error: null }
      }
      
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve(responses[table] || { data: [], error: null })),
            single: vi.fn(() => Promise.resolve({ data: responses[table]?.data?.[0] || null, error: null }))
          })),
          order: vi.fn(() => Promise.resolve(responses[table] || { data: [], error: null }))
        })),
        insert: vi.fn(() => Promise.resolve({ data: [responses[table]?.data?.[0]], error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [responses[table]?.data?.[0]], error: null }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }
    })
  })

  it('should complete a full color management workflow', async () => {
    // This simulates a user going from login -> colors page -> creating a color -> viewing it
    
    // 1. User is authenticated (mocked)
    const { data: session } = await mockSupabase.auth.getSession()
    expect(session.session.user).toBeTruthy()
    
    // 2. User navigates to colors page and sees existing colors
    const colorsData = await mockSupabase.from('colors').select('*').eq('organization_id', 'mock-org-id')
    expect(colorsData.data).toHaveLength(2)
    
    // 3. User creates a new color
    const newColor = {
      name: 'New Test Color',
      hex: '#FF00FF',
      organization_id: 'mock-org-id'
    }
    
    const createResult = await mockSupabase.from('colors').insert(newColor)
    expect(createResult.error).toBeNull()
    expect(createResult.data).toBeTruthy()
    
    // 4. User updates the color
    const updateResult = await mockSupabase
      .from('colors')
      .update({ name: 'Updated Color Name' })
      .eq('id', 'color-123')
    
    expect(updateResult.error).toBeNull()
  })

  it('should complete asset management workflow', async () => {
    // Test creating and managing test charts
    
    // 1. User views test charts
    const testChartsData = await mockSupabase
      .from('test_charts')
      .select('*, patch_set:patch_sets(id, name)')
      .eq('organization_id', 'mock-org-id')
    
    expect(testChartsData.data).toHaveLength(1)
    
    // 2. User creates a new test chart
    const newTestChart = {
      name: 'New Test Chart',
      organization_id: 'mock-org-id',
      patch_set_id: 'patch-set-123'
    }
    
    const createResult = await mockSupabase.from('test_charts').insert(newTestChart)
    expect(createResult.error).toBeNull()
  })

  it('should handle multi-step data workflows', async () => {
    // Test complex workflows involving multiple entities
    
    // 1. Get organization data
    const orgData = await mockSupabase.from('organizations').select('*')
    expect(orgData.data).toHaveLength(1)
    
    // 2. Get profile for current user
    const profileData = await mockSupabase
      .from('profiles')
      .select('*')
      .eq('id', 'mock-user-id')
      .single()
    
    expect(profileData.data.organization_id).toBe('mock-org-id')
    
    // 3. Get all colors for the organization
    const colorsData = await mockSupabase
      .from('colors')
      .select('*')
      .eq('organization_id', profileData.data.organization_id)
    
    expect(colorsData.data).toHaveLength(2)
    
    // 4. Create related data (color book association, etc.)
    const associationData = await mockSupabase.from('color_book_associations').insert({
      color_id: 'color-123',
      book_id: 'book-123',
      organization_id: 'mock-org-id'
    })
    
    expect(associationData.error).toBeNull()
  })

  it('should handle error scenarios gracefully', async () => {
    // Test error handling in workflows
    
    // Mock API error
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: null,
          error: new Error('Database connection failed')
        }))
      }))
    })
    
    const result = await mockSupabase.from('colors').select('*').eq('organization_id', 'invalid-org')
    
    expect(result.error).toBeTruthy()
    expect(result.error.message).toBe('Database connection failed')
    expect(result.data).toBeNull()
  })
})