import QRCode from 'qrcode';
import { config } from '../config.js';

const EC_LEVELS = ['L', 'M', 'Q', 'H'];

function buildOptions(opts, project) {
  const size = opts.size || project.default_size || config.defaults.size;
  const margin = opts.margin !== undefined ? opts.margin : (project.default_margin ?? config.defaults.margin);
  const errorCorrection = (opts.error_correction || project.default_error_correction || config.defaults.errorCorrection).toUpperCase();
  const foreground = opts.foreground || project.default_foreground || config.defaults.foreground;
  const background = opts.background || project.default_background || config.defaults.background;

  if (!EC_LEVELS.includes(errorCorrection)) {
    throw new Error(`Invalid error_correction. Must be one of: ${EC_LEVELS.join(', ')}`);
  }

  return {
    width: size,
    margin,
    errorCorrectionLevel: errorCorrection,
    color: { dark: foreground, light: background },
  };
}

function validateDataLength(data, ecLevel) {
  const maxLengths = { L: 4296, M: 3391, Q: 2420, H: 1852 };
  const max = maxLengths[ecLevel] || maxLengths.M;
  if (data.length > max) {
    throw new Error(
      `Data too long for error_correction=${ecLevel}. Max ${max} chars, got ${data.length}.`
    );
  }
  if (data.length > config.limits.maxDataLength) {
    throw new Error(`Data exceeds maximum length of ${config.limits.maxDataLength}`);
  }
}

export async function generatePNG(data, opts = {}, project = {}) {
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Data must be a non-empty string');
  }
  const options = buildOptions(opts, project);
  validateDataLength(data, options.errorCorrectionLevel);

  const buffer = await QRCode.toBuffer(data, { ...options, type: 'png' });

  return {
    buffer,
    format: 'png',
    contentType: 'image/png',
    size_bytes: buffer.length,
    width: options.width,
    height: options.width,
    error_correction: options.errorCorrectionLevel,
  };
}

export async function generateSVG(data, opts = {}, project = {}) {
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Data must be a non-empty string');
  }
  const options = buildOptions(opts, project);
  validateDataLength(data, options.errorCorrectionLevel);

  const svg = await QRCode.toString(data, { ...options, type: 'svg' });

  return {
    svg,
    format: 'svg',
    contentType: 'image/svg+xml',
    size_bytes: Buffer.byteLength(svg, 'utf8'),
    width: options.width,
    height: options.width,
    error_correction: options.errorCorrectionLevel,
  };
}

export async function generateDataURI(data, opts = {}, project = {}) {
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Data must be a non-empty string');
  }
  const options = buildOptions(opts, project);
  validateDataLength(data, options.errorCorrectionLevel);

  const dataUri = await QRCode.toDataURL(data, options);
  const base64 = dataUri.split(',')[1] || '';

  return {
    dataUri,
    base64,
    format: 'datauri',
    contentType: 'image/png',
    size_bytes: Buffer.byteLength(base64, 'base64'),
    width: options.width,
    height: options.width,
    error_correction: options.errorCorrectionLevel,
  };
}

export async function generateWithLogo(data, logoBuffer, opts = {}, project = {}) {
  const sharp = (await import('sharp')).default;

  const size = opts.size || project.default_size || config.defaults.size;
  const highRes = Math.max(size * 2, 800);

  const base = await generatePNG(data, {
    ...opts,
    size: highRes,
    error_correction: opts.error_correction || 'H',
  }, project);

  const logoSize = Math.floor(highRes * 0.22);
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  const composed = await sharp(base.buffer)
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .resize(size, size)
    .png()
    .toBuffer();

  return {
    buffer: composed,
    format: 'png',
    contentType: 'image/png',
    size_bytes: composed.length,
    width: size,
    height: size,
    error_correction: 'H',
    has_logo: true,
  };
}
