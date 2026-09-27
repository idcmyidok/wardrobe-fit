/**
 * 제품 사진을 올리기 전에 브라우저에서 줄인다. 원본은 올리지 않는다.
 * - 본 이미지: 긴 변 1600px, WebP 품질 0.8
 * - 썸네일: 긴 변 300px
 * canvas로 다시 그려 저장하므로 EXIF(위치 정보 등)는 남지 않는다. 회전 정보는 그리기 전에 반영한다.
 * WebP로 저장할 수 없는 브라우저는 JPEG로 저장한다.
 */
export const IMAGE_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 300;
export const IMAGE_QUALITY = 0.8;
/** 선택할 수 있는 원본 최대 크기. 줄인 뒤의 크기 제한(3MB)은 Storage bucket이 따로 건다. */
export const SOURCE_MAX_BYTES = 30 * 1024 * 1024;

export type PreparedImage = { blob: Blob; width: number; height: number; type: "image/webp" | "image/jpeg" };

export class ImagePrepareError extends Error {
  constructor(public code: "not_image" | "too_large" | "decode_failed" | "encode_failed") {
    super(code);
  }
}

export function scaledSize(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function prepareGarmentImage(file: File): Promise<{ image: PreparedImage; thumb: PreparedImage }> {
  if (!file.type.startsWith("image/")) throw new ImagePrepareError("not_image");
  if (file.size > SOURCE_MAX_BYTES) throw new ImagePrepareError("too_large");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImagePrepareError("decode_failed");
  }
  try {
    const image = await encode(bitmap, IMAGE_MAX_EDGE);
    const thumb = await encode(bitmap, THUMB_MAX_EDGE);
    return { image, thumb };
  } finally {
    bitmap.close();
  }
}

async function encode(bitmap: ImageBitmap, maxEdge: number): Promise<PreparedImage> {
  const { width, height } = scaledSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImagePrepareError("encode_failed");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  const webp = await toBlob(canvas, "image/webp");
  // WebP를 지원하지 않으면 브라우저가 PNG를 돌려준다.
  if (webp?.type === "image/webp") return { blob: webp, width, height, type: "image/webp" };
  const jpeg = await toBlob(canvas, "image/jpeg");
  if (jpeg?.type === "image/jpeg") return { blob: jpeg, width, height, type: "image/jpeg" };
  throw new ImagePrepareError("encode_failed");
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, IMAGE_QUALITY));
}
