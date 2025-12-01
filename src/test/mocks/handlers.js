import { http, HttpResponse } from 'msw'

const API_URL = 'https://rhijzkimxefvkoylryhe.supabase.co'

export const handlers = [
  // Auth endpoints
  http.post(`${API_URL}/auth/v1/token`, () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        role: 'authenticated'
      }
    })
  }),

  http.get(`${API_URL}/auth/v1/user`, () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'test@example.com',
      role: 'authenticated'
    })
  }),

  // Profiles endpoint
  http.get(`${API_URL}/rest/v1/profiles`, () => {
    return HttpResponse.json([
      {
        id: 'mock-user-id',
        full_name: 'Test User',
        role: 'Color User',
        organization_id: 'mock-org-id'
      }
    ])
  }),

  // Colors endpoint
  http.get(`${API_URL}/rest/v1/colors`, () => {
    return HttpResponse.json([
      {
        id: 'color-1',
        name: 'Test Color 1',
        hex: '#FF0000',
        organization_id: 'mock-org-id',
        created_at: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 'color-2',
        name: 'Test Color 2', 
        hex: '#00FF00',
        organization_id: 'mock-org-id',
        created_at: '2024-01-01T00:00:00.000Z'
      }
    ])
  }),

  // Test charts endpoint
  http.get(`${API_URL}/rest/v1/test_charts`, () => {
    return HttpResponse.json([
      {
        id: 'test-chart-1',
        name: 'Test Chart 1',
        organization_id: 'mock-org-id',
        patch_set: {
          id: 'patch-set-1',
          name: 'Patch Set 1'
        }
      }
    ])
  }),

  // Patch sets endpoint  
  http.get(`${API_URL}/rest/v1/patch_sets`, () => {
    return HttpResponse.json([
      {
        id: 'patch-set-1',
        name: 'Patch Set 1',
        organization_id: 'mock-org-id',
        number_of_patches: 10
      }
    ])
  }),

  // Organizations endpoint
  http.get(`${API_URL}/rest/v1/organizations`, () => {
    return HttpResponse.json([
      {
        id: 'mock-org-id',
        name: 'Test Organization',
        type: ['Brand Owner']
      }
    ])
  }),

  // Catch-all for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`)
    return HttpResponse.json({ error: 'Not implemented in mock' }, { status: 501 })
  })
]