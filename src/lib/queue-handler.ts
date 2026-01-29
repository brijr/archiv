import { generateAssetEmbedding, markEmbeddingFailed } from "./server/embeddings"

export interface EmbeddingMessage {
  type: "embed_asset"
  assetId: string
  timestamp: number
  retryCount?: number
}

export async function handleEmbeddingQueue(
  batch: MessageBatch<EmbeddingMessage>,
  _env: Env
): Promise<void> {
  for (const message of batch.messages) {
    const { assetId, retryCount = 0 } = message.body

    try {
      await generateAssetEmbedding(assetId)
      message.ack()
    } catch (error) {
      console.error(`Embedding failed for ${assetId}:`, error)

      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        message.retry({
          delaySeconds: Math.pow(2, retryCount + 1) * 10, // 20s, 40s, 80s
        })
      } else {
        // Give up after 3 retries, mark as failed
        await markEmbeddingFailed(assetId, errorMessage)
        message.ack()
      }
    }
  }
}
