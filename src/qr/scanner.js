import jsQR from 'jsqr';
import sharp from 'sharp';
import { config } from '../config.js';

export async function scanQRCode(imageBuffer) {
  const startTime = Date.now();

  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  if (metadata.width > config.limits.maxImageDimension || metadata.height > config.limits.maxImageDimension) {
    throw new Error(
      `Image too large (${metadata.width}x${metadata.height}). Max ${config.limits.maxImageDimension}px per dimension.`
    );
  }

  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  let result = jsQR(new Uint8ClampedArray(data), width, height, {
    inversionAttempts: 'dontInvert',
  });

  if (!result && config.scan.tryHarder) {
    result = jsQR(new Uint8ClampedArray(data), width, height, {
      inversionAttempts: 'attemptBoth',
    });
  }

  if (!result && Math.max(width, height) < 500) {
    const upscaled = await sharp(imageBuffer)
      .resize(width * 2, height * 2, { kernel: 'nearest' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    result = jsQR(
      new Uint8ClampedArray(upscaled.data),
      upscaled.info.width,
      upscaled.info.height,
      { inversionAttempts: 'attemptBoth' }
    );
  }

  const duration = Date.now() - startTime;

  if (!result) {
    return {
      success: false,
      error: 'No QR code found in image',
      duration_ms: duration,
      image: { width, height, format: metadata.format },
    };
  }

  return {
    success: true,
    data: result.data,
    duration_ms: duration,
    image: { width, height, format: metadata.format },
    location: {
      top_left: result.location.topLeftCorner,
      top_right: result.location.topRightCorner,
      bottom_left: result.location.bottomLeftCorner,
      bottom_right: result.location.bottomRightCorner,
    },
  };
}
