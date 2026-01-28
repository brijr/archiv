import { nanoid } from "nanoid";

/**
 * Slugify a string for use in URLs/filenames
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique R2 key for an asset
 * Format: {nanoid}-{slugified-filename}.{ext}
 */
export function generateR2Key(filename: string): string {
  const id = nanoid(12);
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const slug = slugify(nameWithoutExt);
  return slug ? `${id}-${slug}.${ext}` : `${id}.${ext}`;
}

/**
 * Get the public CDN URL for an asset
 */
export function getCdnUrl(r2Key: string, cdnDomain: string): string {
  return `https://${cdnDomain}/${r2Key}`;
}

/**
 * Delete an object from R2
 */
export async function deleteR2Object(
  bucket: R2Bucket,
  r2Key: string
): Promise<void> {
  await bucket.delete(r2Key);
}

/**
 * Upload a file to R2
 */
export async function uploadToR2(
  bucket: R2Bucket,
  r2Key: string,
  data: ArrayBuffer | ReadableStream,
  contentType: string
): Promise<R2Object> {
  return bucket.put(r2Key, data, {
    httpMetadata: {
      contentType,
    },
  });
}

/**
 * Get content type from filename
 */
export function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    // Videos
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    // Documents
    pdf: "application/pdf",
    // Archives
    zip: "application/zip",
    // Other
    json: "application/json",
    txt: "text/plain",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Check if a file is an image based on mime type
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Check if a file is a video based on mime type
 */
export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}
