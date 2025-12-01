import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils/test-utils'
import ModeSwitcher from '@/components/ModeSwitcher'

// Mock the useRoleAccess hook
vi.mock('@/hooks/useRoleAccess', () => ({
  useRoleAccess: () => ({
    canSeeAdmin: true,
    canSeePrintingAssets: true
  })
}))

// Mock the AppContext
vi.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    appMode: 'matching',
    setAppMode: vi.fn()
  })
}))

describe('ModeSwitcher', () => {
  it('renders all mode options', () => {
    render(<ModeSwitcher />)
    
    expect(screen.getByText('Colors & Matching')).toBeInTheDocument()
    expect(screen.getByText('Printing Assets')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('highlights the active mode', () => {
    render(<ModeSwitcher />)
    
    const matchingButton = screen.getByText('Colors & Matching').closest('button')
    expect(matchingButton).toHaveClass('text-switcher-active-text')
  })

  it('calls setAppMode when a mode is clicked', async () => {
    const user = userEvent.setup()
    const mockSetAppMode = vi.fn()
    
    vi.mocked(require('@/context/AppContext').useAppContext).mockReturnValue({
      appMode: 'matching',
      setAppMode: mockSetAppMode
    })
    
    render(<ModeSwitcher />)
    
    await user.click(screen.getByText('Printing Assets'))
    expect(mockSetAppMode).toHaveBeenCalledWith('assets')
  })

  it('shows correct icons for each mode', () => {
    render(<ModeSwitcher />)
    
    // Check that SVG icons are rendered (lucide-react icons render as SVGs)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })
})