import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateR2Key,
  getCdnUrl,
  getContentType,
  isImage,
  isVideo,
  deleteR2Object,
  uploadToR2,
} from '@/lib/r2'

// Mock nanoid to get predictable keys
vi.mock('nanoid', () => ({
  nanoid: () => 'test12nanoid',
}))

describe('generateR2Key', () => {
  it('should generate key with nanoid prefix', () => {
    const key = generateR2Key('my-photo.jpg')
    expect(key).toBe('test12nanoid-my-photo.jpg')
  })

  it('should slugify filename', () => {
    const key = generateR2Key('My Photo Name.PNG')
    expect(key).toBe('test12nanoid-my-photo-name.png')
  })

  it('should handle files without extension', () => {
    const key = generateR2Key('README')
    // Without a dot, the whole filename is treated as the extension
    expect(key).toBe('test12nanoid-readme.readme')
  })

  it('should handle files with special characters', () => {
    const key = generateR2Key('My File (1).jpg')
    expect(key).toBe('test12nanoid-my-file-1.jpg')
  })

  it('should handle uppercase extensions', () => {
    const key = generateR2Key('photo.JPEG')
    expect(key).toBe('test12nanoid-photo.jpeg')
  })

  it('should handle multiple dots in filename', () => {
    const key = generateR2Key('photo.backup.jpg')
    expect(key).toBe('test12nanoid-photobackup.jpg')
  })
})

describe('getCdnUrl', () => {
  it('should construct correct CDN URL', () => {
    const url = getCdnUrl('abc123-photo.jpg', 'cdn.example.com')
    expect(url).toBe('https://cdn.example.com/abc123-photo.jpg')
  })

  it('should handle keys with paths', () => {
    const url = getCdnUrl('folder/abc123-photo.jpg', 'cdn.example.com')
    expect(url).toBe('https://cdn.example.com/folder/abc123-photo.jpg')
  })
})

describe('getContentType', () => {
  describe('images', () => {
    it('should return correct MIME type for PNG', () => {
      expect(getContentType('photo.png')).toBe('image/png')
    })

    it('should return correct MIME type for JPG', () => {
      expect(getContentType('photo.jpg')).toBe('image/jpeg')
    })

    it('should return correct MIME type for JPEG', () => {
      expect(getContentType('photo.jpeg')).toBe('image/jpeg')
    })

    it('should return correct MIME type for GIF', () => {
      expect(getContentType('photo.gif')).toBe('image/gif')
    })

    it('should return correct MIME type for WebP', () => {
      expect(getContentType('photo.webp')).toBe('image/webp')
    })

    it('should return correct MIME type for SVG', () => {
      expect(getContentType('icon.svg')).toBe('image/svg+xml')
    })

    it('should return correct MIME type for ICO', () => {
      expect(getContentType('favicon.ico')).toBe('image/x-icon')
    })
  })

  describe('videos', () => {
    it('should return correct MIME type for MP4', () => {
      expect(getContentType('video.mp4')).toBe('video/mp4')
    })

    it('should return correct MIME type for WebM', () => {
      expect(getContentType('video.webm')).toBe('video/webm')
    })

    it('should return correct MIME type for MOV', () => {
      expect(getContentType('video.mov')).toBe('video/quicktime')
    })
  })

  describe('documents', () => {
    it('should return correct MIME type for PDF', () => {
      expect(getContentType('doc.pdf')).toBe('application/pdf')
    })

    it('should return correct MIME type for JSON', () => {
      expect(getContentType('data.json')).toBe('application/json')
    })

    it('should return correct MIME type for TXT', () => {
      expect(getContentType('readme.txt')).toBe('text/plain')
    })

    it('should return correct MIME type for ZIP', () => {
      expect(getContentType('archive.zip')).toBe('application/zip')
    })
  })

  describe('unknown types', () => {
    it('should return octet-stream for unknown extensions', () => {
      expect(getContentType('file.unknown')).toBe('application/octet-stream')
    })

    it('should return octet-stream for files without extension', () => {
      expect(getContentType('file')).toBe('application/octet-stream')
    })
  })

  describe('case insensitivity', () => {
    it('should handle uppercase extensions', () => {
      expect(getContentType('photo.PNG')).toBe('image/png')
    })

    it('should handle mixed case extensions', () => {
      expect(getContentType('photo.JpEg')).toBe('image/jpeg')
    })
  })
})

describe('isImage', () => {
  it('should return true for image MIME types', () => {
    expect(isImage('image/png')).toBe(true)
    expect(isImage('image/jpeg')).toBe(true)
    expect(isImage('image/gif')).toBe(true)
    expect(isImage('image/webp')).toBe(true)
    expect(isImage('image/svg+xml')).toBe(true)
  })

  it('should return false for non-image MIME types', () => {
    expect(isImage('video/mp4')).toBe(false)
    expect(isImage('application/pdf')).toBe(false)
    expect(isImage('text/plain')).toBe(false)
  })
})

describe('isVideo', () => {
  it('should return true for video MIME types', () => {
    expect(isVideo('video/mp4')).toBe(true)
    expect(isVideo('video/webm')).toBe(true)
    expect(isVideo('video/quicktime')).toBe(true)
  })

  it('should return false for non-video MIME types', () => {
    expect(isVideo('image/png')).toBe(false)
    expect(isVideo('application/pdf')).toBe(false)
    expect(isVideo('audio/mp3')).toBe(false)
  })
})

describe('deleteR2Object', () => {
  it('should call bucket.delete with the key', async () => {
    const mockBucket = {
      delete: vi.fn().mockResolvedValue(undefined),
    }

    await deleteR2Object(mockBucket as unknown as R2Bucket, 'test-key.jpg')

    expect(mockBucket.delete).toHaveBeenCalledWith('test-key.jpg')
  })
})

describe('uploadToR2', () => {
  it('should call bucket.put with correct parameters', async () => {
    const mockResult = { key: 'test-key.jpg' }
    const mockBucket = {
      put: vi.fn().mockResolvedValue(mockResult),
    }
    const data = new ArrayBuffer(100)

    const result = await uploadToR2(
      mockBucket as unknown as R2Bucket,
      'test-key.jpg',
      data,
      'image/jpeg'
    )

    expect(mockBucket.put).toHaveBeenCalledWith('test-key.jpg', data, {
      httpMetadata: {
        contentType: 'image/jpeg',
      },
    })
    expect(result).toBe(mockResult)
  })
})
