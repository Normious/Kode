import { generatePNG, generateSVG, generateDataURI } from '../qr/generator.js';
import { buildPreset } from '../qr/presets.js';
import { logHistory } from '../db.js';
import { config } from '../config.js';

const generateSchema = {
  body: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'string', minLength: 1 },
      format: { type: 'string', enum: ['png', 'svg', 'datauri', 'json'], default: 'png' },
      size: { type: 'number', minimum: 100, maximum: 2000 },
      margin: { type: 'number', minimum: 0, maximum: 10 },
      error_correction: { type: 'string', enum: ['L', 'M', 'Q', 'H'] },
      foreground: { type: 'string' },
      background: { type: 'string' },
      content_type: { type: 'string' },
      metadata: { type: 'object' },
    },
  },
};

const presetSchema = {
  body: {
    type: 'object',
    required: ['preset', 'payload'],
    properties: {
      preset: { type: 'string' },
      payload: { type: 'object' },
      format: { type: 'string', enum: ['png', 'svg', 'datauri', 'json'], default: 'png' },
      size: { type: 'number', minimum: 100, maximum: 2000 },
      margin: { type: 'number', minimum: 0, maximum: 10 },
      error_correction: { type: 'string', enum: ['L', 'M', 'Q', 'H'] },
      foreground: { type: 'string' },
      background: { type: 'string' },
    },
  },
};

const batchSchema = {
  body: {
    type: 'object',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: {
          type: 'object',
          properties: {
            data: { type: 'string' },
            preset: { type: 'string' },
            payload: { type: 'object' },
            format: { type: 'string', enum: ['png', 'svg', 'datauri'] },
            size: { type: 'number' },
            margin: { type: 'number' },
            error_correction: { type: 'string' },
            foreground: { type: 'string' },
            background: { type: 'string' },
          },
        },
      },
    },
  },
};

async function generateByFormat(data, opts, format, project) {
  if (format === 'png') return await generatePNG(data, opts, project);
  if (format === 'svg') return await generateSVG(data, opts, project);
  if (format === 'datauri') return await generateDataURI(data, opts, project);
  if (format === 'json') {
    const png = await generatePNG(data, opts, project);
    return { ...png, base64: png.buffer.toString('base64') };
  }
  throw new Error(`Unsupported format: ${format}`);
}

function sendGenerated(reply, result, format) {
  if (format === 'svg') {
    return reply
      .header('Content-Type', 'image/svg+xml')
      .header('X-QR-Error-Correction', result.error_correction)
      .send(result.svg);
  }

  if (format === 'datauri') {
    return reply.send({
      success: true,
      format: 'datauri',
      data_uri: result.dataUri,
      base64: result.base64,
      size_bytes: result.size_bytes,
      width: result.width,
      height: result.height,
      error_correction: result.error_correction,
    });
  }

  if (format === 'json') {
    return reply.send({
      success: true,
      format: 'png',
      base64: result.base64,
      size_bytes: result.size_bytes,
      width: result.width,
      height: result.height,
      error_correction: result.error_correction,
    });
  }

  return reply
    .header('Content-Type', 'image/png')
    .header('Content-Disposition', `inline; filename="qr-${Date.now()}.png"`)
    .header('X-QR-Size-Bytes', String(result.size_bytes))
    .header('X-QR-Error-Correction', result.error_correction)
    .send(result.buffer);
}

export default async function generateRoutes(fastify) {
  fastify.post('/qr/generate', { schema: generateSchema }, async (request, reply) => {
    const project = request.project;
    const body = request.body;
    const startTime = Date.now();

    const format = body.format || 'png';
    const opts = {
      size: body.size,
      margin: body.margin,
      error_correction: body.error_correction,
      foreground: body.foreground,
      background: body.background,
    };

    try {
      const result = await generateByFormat(body.data, opts, format, project);
      const duration = Date.now() - startTime;

      logHistory(project.id, {
        operation: 'generate',
        content_type: body.content_type || 'text',
        content_preview: body.data,
        data_length: body.data.length,
        output_format: format,
        output_size_bytes: result.size_bytes,
        image_width: result.width,
        image_height: result.height,
        error_correction: result.error_correction,
        duration_ms: duration,
        status: 'success',
        client_ip: request.ip,
        user_agent: request.headers['user-agent'],
        metadata: body.metadata,
      });

      return sendGenerated(reply, result, format);
    } catch (error) {
      logHistory(project.id, {
        operation: 'generate',
        content_preview: body.data,
        duration_ms: Date.now() - startTime,
        status: 'failed',
        error_message: error.message,
        client_ip: request.ip,
      });
      return reply.status(400).send({ error: error.message });
    }
  });

  fastify.post('/qr/generate/preset', { schema: presetSchema }, async (request, reply) => {
    const project = request.project;
    const body = request.body;
    const startTime = Date.now();

    try {
      const built = buildPreset(body.preset, body.payload);
      const format = body.format || 'png';

      const opts = {
        size: body.size,
        margin: body.margin,
        error_correction: body.error_correction,
        foreground: body.foreground,
        background: body.background,
      };

      const result = await generateByFormat(built.content, opts, format, project);
      const duration = Date.now() - startTime;

      logHistory(project.id, {
        operation: 'preset',
        preset: body.preset,
        content_type: built.content_type,
        content_preview: built.content,
        data_length: built.content.length,
        output_format: format,
        output_size_bytes: result.size_bytes,
        image_width: result.width,
        image_height: result.height,
        error_correction: result.error_correction,
        duration_ms: duration,
        status: 'success',
        client_ip: request.ip,
        user_agent: request.headers['user-agent'],
      });

      return sendGenerated(reply, result, format);
    } catch (error) {
      logHistory(project.id, {
        operation: 'preset',
        preset: body.preset,
        duration_ms: Date.now() - startTime,
        status: 'failed',
        error_message: error.message,
        client_ip: request.ip,
      });
      return reply.status(400).send({ error: error.message });
    }
  });

  fastify.post('/qr/generate/batch', { schema: batchSchema }, async (request, reply) => {
    const project = request.project;
    const { items } = request.body;

    if (items.length > config.limits.maxBatchSize) {
      return reply.status(400).send({
        error: `Batch size exceeds maximum of ${config.limits.maxBatchSize}`,
      });
    }

    const startTime = Date.now();
    const results = [];

    for (const item of items) {
      try {
        let content = item.data;
        let contentType = 'text';
        let presetName = null;

        if (item.preset && item.payload) {
          const built = buildPreset(item.preset, item.payload);
          content = built.content;
          contentType = built.content_type;
          presetName = item.preset;
        }

        if (!content) throw new Error('Item needs "data" or "preset"+"payload"');

        const format = item.format || 'datauri';
        const opts = {
          size: item.size,
          margin: item.margin,
          error_correction: item.error_correction,
          foreground: item.foreground,
          background: item.background,
        };

        const result = await generateByFormat(content, opts, format, project);

        logHistory(project.id, {
          operation: 'batch',
          preset: presetName,
          content_type: contentType,
          content_preview: content,
          data_length: content.length,
          output_format: format,
          output_size_bytes: result.size_bytes,
          image_width: result.width,
          image_height: result.height,
          error_correction: result.error_correction,
          status: 'success',
          client_ip: request.ip,
        });

        results.push({
          success: true,
          preset: presetName,
          content_type: contentType,
          format,
          base64: result.base64 || (result.buffer ? result.buffer.toString('base64') : null),
          svg: result.svg || null,
          data_uri: result.dataUri || null,
          size_bytes: result.size_bytes,
          width: result.width,
          height: result.height,
        });
      } catch (error) {
        logHistory(project.id, {
          operation: 'batch',
          preset: item.preset,
          content_preview: item.data,
          status: 'failed',
          error_message: error.message,
        });
        results.push({ success: false, error: error.message });
      }
    }

    return reply.send({
      success: true,
      total: items.length,
      succeeded: results.filter((r) => r.success).length,
      duration_ms: Date.now() - startTime,
      results,
    });
  });
}
