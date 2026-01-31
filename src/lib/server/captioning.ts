import { env } from "cloudflare:workers"

// Model configuration - easy to swap later
export const CAPTION_MODEL = "@cf/unum/uform-gen2-qwen-500m" as const
export const CAPTION_PROMPT = "Generate a concise, descriptive caption for this image"
export const CAPTION_MAX_TOKENS = 512

// Types for the vision model response
export interface CaptionResult {
  caption: string
  model: string
}

// MIME types that support AI captioning
// Note: SVG excluded - vector format not supported by vision models
const CAPTIONABLE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]

/**
 * Check if a MIME type supports AI captioning
 */
export function isCaptionable(mimeType: string): boolean {
  return CAPTIONABLE_TYPES.includes(mimeType)
}

/**
 * Generate an AI caption for image data using Cloudflare Workers AI
 */
export async function generateCaption(imageData: ArrayBuffer): Promise<CaptionResult> {
  const input = {
    image: [...new Uint8Array(imageData)],
    prompt: CAPTION_PROMPT,
    max_tokens: CAPTION_MAX_TOKENS,
  }

  const response = (await env.AI.run(CAPTION_MODEL, input)) as { description: string }

  return {
    caption: response.description,
    model: CAPTION_MODEL,
  }
}
