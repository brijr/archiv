import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadDropzone } from '@/components/UploadDropzone'

// Mock server function
vi.mock('@/lib/server/assets', () => ({
  uploadAsset: vi.fn(),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { uploadAsset } from '@/lib/server/assets'
import { toast } from 'sonner'

describe('UploadDropzone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(uploadAsset).mockResolvedValue({
      id: 'test-id',
      filename: 'test.png',
      url: 'https://cdn.test/test.png',
    })
  })

  it('should render drop zone with instructions', () => {
    render(<UploadDropzone />)

    expect(screen.getByText('Drag and drop files here')).toBeInTheDocument()
    expect(screen.getByText('or click to select files')).toBeInTheDocument()
  })

  it('should show supported file types info', () => {
    render(<UploadDropzone />)

    expect(screen.getByText(/Supports images, videos, and PDFs/)).toBeInTheDocument()
  })

  it('should accept files via file input', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)

    expect(screen.getByText('test.png')).toBeInTheDocument()
  })

  it('should show file size', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const content = 'x'.repeat(1024)
    const file = new File([content], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)

    expect(screen.getByText('1 KB')).toBeInTheDocument()
  })

  it('should reject unsupported file types', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    // Create a file with an unsupported but valid MIME type
    // The accept attribute filters files in real browsers, but we need to test validation
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    // Remove accept attribute to allow the upload in tests
    input.removeAttribute('accept')

    await user.upload(input, file)

    // The error message contains "is not supported"
    await waitFor(() => {
      expect(screen.getByText(/is not supported/i)).toBeInTheDocument()
    })
  })

  it('should reject files exceeding max size', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone maxSize={1024} />) // 1KB max

    const content = 'x'.repeat(2048) // 2KB file
    const file = new File([content], 'large.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)

    expect(screen.getByText(/exceeds/i)).toBeInTheDocument()
  })

  it('should show upload button when files are pending', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)

    expect(screen.getByText(/Upload 1 file/i)).toBeInTheDocument()
  })

  it('should show correct count for multiple files', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const files = [
      new File(['test1'], 'test1.png', { type: 'image/png' }),
      new File(['test2'], 'test2.png', { type: 'image/png' }),
      new File(['test3'], 'test3.png', { type: 'image/png' }),
    ]
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, files)

    expect(screen.getByText(/Upload 3 files/i)).toBeInTheDocument()
  })

  it('should upload files when upload button is clicked', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)
    await user.click(screen.getByText(/Upload 1 file/i))

    await waitFor(() => {
      expect(uploadAsset).toHaveBeenCalled()
    })
  })

  it('should show success toast after upload', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)
    await user.click(screen.getByText(/Upload 1 file/i))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Uploaded test.png')
    })
  })

  it('should call onUploadComplete with results', async () => {
    const user = userEvent.setup()
    const onUploadComplete = vi.fn()
    const mockResult = { id: 'test-id', filename: 'test.png' }
    vi.mocked(uploadAsset).mockResolvedValue(mockResult)

    render(<UploadDropzone onUploadComplete={onUploadComplete} />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)
    await user.click(screen.getByText(/Upload 1 file/i))

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalledWith([mockResult])
    })
  })

  it('should show error toast on upload failure', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadAsset).mockRejectedValue(new Error('Upload failed'))

    render(<UploadDropzone />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)
    await user.click(screen.getByText(/Upload 1 file/i))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to upload test.png')
    })
  })

  it('should allow removing files from queue', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)
    expect(screen.getByText('test.png')).toBeInTheDocument()

    // Find and click the remove button
    const removeButtons = screen.getAllByRole('button')
    const removeButton = removeButtons.find((btn) =>
      btn.querySelector('svg')
    )
    if (removeButton) {
      await user.click(removeButton)
    }

    // File should be removed
    await waitFor(() => {
      expect(screen.queryByText('test.png')).not.toBeInTheDocument()
    })
  })

  it('should show Clear All button when files exist', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)

    expect(screen.getByText('Clear All')).toBeInTheDocument()
  })

  it('should clear all files when Clear All is clicked', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone />)

    const files = [
      new File(['test1'], 'test1.png', { type: 'image/png' }),
      new File(['test2'], 'test2.png', { type: 'image/png' }),
    ]
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, files)
    expect(screen.getByText('test1.png')).toBeInTheDocument()

    await user.click(screen.getByText('Clear All'))

    expect(screen.queryByText('test1.png')).not.toBeInTheDocument()
    expect(screen.queryByText('test2.png')).not.toBeInTheDocument()
  })

  it('should change text on drag over', () => {
    render(<UploadDropzone />)

    const dropzone = screen.getByText('Drag and drop files here').closest('div')!

    fireEvent.dragOver(dropzone)

    expect(screen.getByText('Drop files here')).toBeInTheDocument()
  })

  it('should revert text on drag leave', () => {
    render(<UploadDropzone />)

    const dropzone = screen.getByText('Drag and drop files here').closest('div')!

    fireEvent.dragOver(dropzone)
    expect(screen.getByText('Drop files here')).toBeInTheDocument()

    fireEvent.dragLeave(dropzone)
    expect(screen.getByText('Drag and drop files here')).toBeInTheDocument()
  })

  it('should accept multiple files', () => {
    render(<UploadDropzone />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toHaveAttribute('multiple')
  })

  it('should pass folderId to upload function', async () => {
    const user = userEvent.setup()
    render(<UploadDropzone folderId="folder-123" />)

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, file)
    await user.click(screen.getByText(/Upload 1 file/i))

    await waitFor(() => {
      expect(uploadAsset).toHaveBeenCalled()
      const callArg = vi.mocked(uploadAsset).mock.calls[0][0]
      const formData = callArg.data as FormData
      expect(formData.get('folderId')).toBe('folder-123')
    })
  })
})
