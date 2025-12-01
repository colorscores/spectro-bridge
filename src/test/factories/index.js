// Test data factories for consistent test data creation

export const createMockUser = (overrides = {}) => ({
  id: 'mock-user-id',
  email: 'test@example.com',
  role: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
  ...overrides
})

export const createMockProfile = (overrides = {}) => ({
  id: 'mock-user-id',
  full_name: 'Test User',
  role: 'Color User',
  organization_id: 'mock-org-id',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides
})

export const createMockOrganization = (overrides = {}) => ({
  id: 'mock-org-id',
  name: 'Test Organization',
  type: ['Brand Owner'],
  location: 'Test Location',
  created_at: '2024-01-01T00:00:00.000Z',
  ...overrides
})

export const createMockColor = (overrides = {}) => ({
  id: `color-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Color',
  hex: '#FF0000',
  lab_l: 53.23,
  lab_a: 80.11,
  lab_b: 67.22,
  standard_type: 'production',
  status: 'Production',
  organization_id: 'mock-org-id',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  created_by: 'mock-user-id',
  last_edited_by: 'mock-user-id',
  ...overrides
})

export const createMockTestChart = (overrides = {}) => ({
  id: `test-chart-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Chart',
  organization_id: 'mock-org-id',
  patch_set_id: 'mock-patch-set-id',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  patch_set: {
    id: 'mock-patch-set-id',
    name: 'Mock Patch Set'
  },
  ...overrides
})

export const createMockPatchSet = (overrides = {}) => ({
  id: `patch-set-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Mock Patch Set',
  organization_id: 'mock-org-id',
  number_of_patches: 10,
  colorspace: 'CMYK',
  printing_channels: 4,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  created_by: 'mock-user-id',
  ...overrides
})

export const createMockInk = (overrides = {}) => ({
  id: `ink-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Ink',
  type: 'Process',
  material: 'Offset',
  print_process: 'Sheetfed',
  organization_id: 'mock-org-id',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides
})

export const createMockSubstrate = (overrides = {}) => ({
  id: `substrate-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Substrate',
  material: 'Paper',
  weight: 120,
  finish: 'Gloss',
  organization_id: 'mock-org-id',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides
})

export const createMockPrinter = (overrides = {}) => ({
  id: `printer-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Printer',
  manufacturer: 'Test Manufacturer',
  model: 'Test Model',
  print_process: 'Digital',
  organization_id: 'mock-org-id',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides
})

export const createMockMatchRequest = (overrides = {}) => ({
  id: `match-request-${Math.random().toString(36).substr(2, 9)}`,
  job_id: 'JOB-20240101-0001',
  status: 'New',
  organization_id: 'mock-org-id',
  shared_with: 'Partner Organization',
  shared_with_org_id: 'partner-org-id',
  print_process: 'Offset',
  print_condition: 'Standard',
  due_date: '2024-02-01',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides
})