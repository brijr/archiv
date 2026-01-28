import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateFolderDialog } from '@/components/dialogs/CreateFolderDialog'

// Mock server function
vi.mock('@/lib/server/folders', () => ({
  createFolder: vi.fn(),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { createFolder } from '@/lib/server/folders'
import { toast } from 'sonner'

describe('CreateFolderDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createFolder).mockResolvedValue({
      id: 'new-folder-id',
      name: 'Test Folder',
      slug: 'test-folder',
      parentId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  })

  it('should render dialog when open', () => {
    render(<CreateFolderDialog {...defaultProps} />)

    expect(screen.getByText('Create Folder')).toBeInTheDocument()
    expect(screen.getByText('Create a new folder to organize your assets.')).toBeInTheDocument()
    expect(screen.getByLabelText('Folder Name')).toBeInTheDocument()
  })

  it('should not render dialog content when closed', () => {
    render(<CreateFolderDialog {...defaultProps} open={false} />)

    expect(screen.queryByText('Create Folder')).not.toBeInTheDocument()
  })

  it('should show error toast when submitting empty name', async () => {
    const user = userEvent.setup()
    render(<CreateFolderDialog {...defaultProps} />)

    // The Create button should be disabled when name is empty
    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).toBeDisabled()
  })

  it('should show error toast when submitting whitespace-only name', async () => {
    const user = userEvent.setup()
    render(<CreateFolderDialog {...defaultProps} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, '   ')

    // Button should still be disabled with whitespace-only
    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).toBeDisabled()
  })

  it('should enable create button when name is provided', async () => {
    const user = userEvent.setup()
    render(<CreateFolderDialog {...defaultProps} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder')

    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).not.toBeDisabled()
  })

  it('should create folder on submit', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    render(<CreateFolderDialog {...defaultProps} onCreated={onCreated} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createFolder).toHaveBeenCalledWith({
        data: { name: 'My Folder', parentId: undefined },
      })
    })
  })

  it('should show success toast after creation', async () => {
    const user = userEvent.setup()
    render(<CreateFolderDialog {...defaultProps} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Folder created')
    })
  })

  it('should call onCreated callback after successful creation', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    render(<CreateFolderDialog {...defaultProps} onCreated={onCreated} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled()
    })
  })

  it('should close dialog after successful creation', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<CreateFolderDialog {...defaultProps} onOpenChange={onOpenChange} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('should clear input after successful creation', async () => {
    const user = userEvent.setup()
    render(<CreateFolderDialog {...defaultProps} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('should show loading state while creating', async () => {
    const user = userEvent.setup()
    // Make createFolder hang
    vi.mocked(createFolder).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )
    render(<CreateFolderDialog {...defaultProps} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    })
  })

  it('should show error toast on creation failure', async () => {
    const user = userEvent.setup()
    vi.mocked(createFolder).mockRejectedValue(new Error('Server error'))
    render(<CreateFolderDialog {...defaultProps} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create folder')
    })
  })

  it('should close dialog when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<CreateFolderDialog {...defaultProps} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should submit on Enter key press', async () => {
    const user = userEvent.setup()
    render(<CreateFolderDialog {...defaultProps} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'My Folder{Enter}')

    await waitFor(() => {
      expect(createFolder).toHaveBeenCalled()
    })
  })

  it('should pass parentId to createFolder', async () => {
    const user = userEvent.setup()
    render(<CreateFolderDialog {...defaultProps} parentId="parent-123" />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, 'Subfolder')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createFolder).toHaveBeenCalledWith({
        data: { name: 'Subfolder', parentId: 'parent-123' },
      })
    })
  })

  it('should trim folder name before submission', async () => {
    const user = userEvent.setup()
    render(<CreateFolderDialog {...defaultProps} />)

    const input = screen.getByLabelText('Folder Name')
    await user.type(input, '  Trimmed Name  ')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createFolder).toHaveBeenCalledWith({
        data: { name: 'Trimmed Name', parentId: undefined },
      })
    })
  })
})
