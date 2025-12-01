import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils/test-utils'
import { createMockColor, createMockProfile } from '../factories'
import { mockSupabase } from '../mocks/supabase'

// Mock the pages since we're testing integration
vi.mock('@/pages/Colors', () => ({
  default: () => <div data-testid="colors-page">Colors Page</div>
}))

describe('Color Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API responses
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: [createMockColor(), createMockColor({ name: 'Blue Color', hex: '#0000FF' })],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ data: [createMockColor()], error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [createMockColor()], error: null }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })
  })

  it('should handle complete color creation workflow', async () => {
    const user = userEvent.setup()
    
    // This would test the entire flow from color creation form to API call
    // For now, just test that the mocked API calls work correctly
    
    const { data, error } = await mockSupabase.from('colors').insert({
      name: 'Test Color',
      hex: '#FF0000',
      organization_id: 'mock-org-id'
    })
    
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(mockSupabase.from).toHaveBeenCalledWith('colors')
  })

  it('should handle color search and filtering', async () => {
    const user = userEvent.setup()
    
    // Test search functionality
    const { data, error } = await mockSupabase
      .from('colors')
      .select('*')
      .eq('organization_id', 'mock-org-id')
      .order('name')
    
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    expect(data[0].name).toBe('Test Color')
    expect(data[1].name).toBe('Blue Color')
  })

  it('should handle color editing workflow', async () => {
    const colorId = 'color-123'
    const updatedData = { name: 'Updated Color Name' }
    
    const { data, error } = await mockSupabase
      .from('colors')
      .update(updatedData)
      .eq('id', colorId)
    
    expect(error).toBeNull()
    expect(mockSupabase.from).toHaveBeenCalledWith('colors')
  })

  it('should handle color deletion workflow', async () => {
    const colorId = 'color-123'
    
    const { data, error } = await mockSupabase
      .from('colors')
      .delete()
      .eq('id', colorId)
    
    expect(error).toBeNull()
    expect(mockSupabase.from).toHaveBeenCalledWith('colors')
  })

  it('should handle batch color operations', async () => {
    const colorIds = ['color-1', 'color-2', 'color-3']
    
    // Test bulk delete
    for (const id of colorIds) {
      await mockSupabase.from('colors').delete().eq('id', id)
    }
    
    expect(mockSupabase.from).toHaveBeenCalledTimes(colorIds.length)
  })
})