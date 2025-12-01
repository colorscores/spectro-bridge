import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils/test-utils'
import TestchartsHeader from '@/components/testcharts/TestchartsHeader'

describe('TestchartsHeader', () => {
  const defaultProps = {
    onAddNew: vi.fn(),
    onResetView: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the header with correct title', () => {
    render(<TestchartsHeader {...defaultProps} />)
    
    expect(screen.getByText('Test Charts')).toBeInTheDocument()
    expect(screen.getByText('Manage test charts for color calibration and quality control')).toBeInTheDocument()
  })

  it('renders Add New button and calls onAddNew when clicked', async () => {
    const user = userEvent.setup()
    render(<TestchartsHeader {...defaultProps} />)
    
    const addButton = screen.getByText('Add New')
    expect(addButton).toBeInTheDocument()
    
    await user.click(addButton)
    expect(defaultProps.onAddNew).toHaveBeenCalledTimes(1)
  })

  it('renders Reset View button and calls onResetView when clicked', async () => {
    const user = userEvent.setup()
    render(<TestchartsHeader {...defaultProps} />)
    
    const resetButton = screen.getByText('Reset View')
    expect(resetButton).toBeInTheDocument()
    
    await user.click(resetButton)
    expect(defaultProps.onResetView).toHaveBeenCalledTimes(1)
  })

  it('has proper button styling and icons', () => {
    render(<TestchartsHeader {...defaultProps} />)
    
    const addButton = screen.getByText('Add New').closest('button')
    const resetButton = screen.getByText('Reset View').closest('button')
    
    expect(addButton).toHaveClass('bg-primary')
    expect(resetButton).toHaveClass('border-input')
    
    // Check for icons (lucide-react icons render as SVGs)
    expect(addButton.querySelector('svg')).toBeInTheDocument()
    expect(resetButton.querySelector('svg')).toBeInTheDocument()
  })
})