interface R2ObjectMeta {
  key: string
  size: number
  etag: string
  httpMetadata?: { contentType?: string }
  uploaded: Date
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string }
}

export function createMockR2Bucket() {
  const storage = new Map<string, { data: ArrayBuffer; metadata: R2ObjectMeta }>()

  return {
    async put(
      key: string,
      value: ArrayBuffer | ReadableStream | string,
      options?: R2PutOptions
    ) {
      let data: ArrayBuffer
      if (value instanceof ArrayBuffer) {
        data = value
      } else if (typeof value === 'string') {
        data = new TextEncoder().encode(value).buffer as ArrayBuffer
      } else {
        // Handle ReadableStream
        const chunks: Uint8Array[] = []
        const reader = value.getReader()
        while (true) {
          const { done, value: chunk } = await reader.read()
          if (done) break
          chunks.push(chunk)
        }
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
        const combined = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          combined.set(chunk, offset)
          offset += chunk.length
        }
        data = combined.buffer as ArrayBuffer
      }

      const meta: R2ObjectMeta = {
        key,
        size: data.byteLength,
        etag: `"${Date.now()}"`,
        httpMetadata: options?.httpMetadata,
        uploaded: new Date(),
      }

      storage.set(key, { data, metadata: meta })

      return {
        key,
        size: meta.size,
        etag: meta.etag,
        httpMetadata: meta.httpMetadata || {},
        uploaded: meta.uploaded,
        version: '1',
        checksums: {},
        storageClass: 'Standard',
        writeHttpMetadata: () => {},
      }
    },

    async get(key: string) {
      const item = storage.get(key)
      if (!item) return null

      return {
        ...item.metadata,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(item.data))
            controller.close()
          },
        }),
        bodyUsed: false,
        arrayBuffer: async () => item.data,
        text: async () => new TextDecoder().decode(item.data),
        json: async () => JSON.parse(new TextDecoder().decode(item.data)),
        blob: async () => new Blob([item.data]),
        writeHttpMetadata: () => {},
      }
    },

    async delete(keys: string | string[]): Promise<void> {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      keyArray.forEach((k) => storage.delete(k))
    },

    async head(key: string) {
      const item = storage.get(key)
      if (!item) return null
      return item.metadata
    },

    async list() {
      const objects = Array.from(storage.values()).map((v) => v.metadata)
      return {
        objects,
        truncated: false,
        delimitedPrefixes: [],
      }
    },

    // Helper for tests
    _storage: storage,
    _clear() {
      storage.clear()
    },
  }
}

export type MockR2Bucket = ReturnType<typeof createMockR2Bucket>
