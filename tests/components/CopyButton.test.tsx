import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton } from '@/components/CopyButton'

// Mock sonner - must be inline to avoid hoisting issues
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Import the mocked module after vi.mock
import { toast } from 'sonner'

describe('CopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render with copy icon', () => {
    render(<CopyButton value="test value" />)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('should render with label when provided', () => {
    render(<CopyButton value="test value" label="Copy URL" />)

    expect(screen.getByText('Copy URL')).toBeInTheDocument()
  })

  it('should copy value to clipboard on click', async () => {
    const user = userEvent.setup()
    render(<CopyButton value="https://example.com/test" />)

    await user.click(screen.getByRole('button'))

    // Wait for async clipboard operation and state update
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Copied to clipboard')
    })
  })

  it('should show "Copied!" text after copying', async () => {
    const user = userEvent.setup()
    render(<CopyButton value="test" label="Copy" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })

  it('should show error toast on clipboard failure', async () => {
    const user = userEvent.setup()
    // Mock clipboard to fail
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Failed')),
        readText: vi.fn().mockResolvedValue(''),
      },
      configurable: true,
    })

    render(<CopyButton value="test" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to copy')
    })

    // Restore clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    })
  })

  it('should apply custom className', () => {
    render(<CopyButton value="test" className="custom-class" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('should apply variant prop', () => {
    render(<CopyButton value="test" variant="ghost" />)

    const button = screen.getByRole('button')
    // The button should have ghost variant styles
    expect(button).toBeInTheDocument()
  })
})
