import { scanQRCode } from '../qr/scanner.js';
import { logHistory } from '../db.js';
import { config } from '../config.js';

export default async function scanRoutes(fastify) {
  fastify.post('/qr/scan', async (request, reply) => {
    const project = request.project;
    const startTime = Date.now();

    let data;
    try {
      data = await request.file({
        limits: { fileSize: config.limits.maxImageSizeBytes },
      });
    } catch (err) {
      return reply.status(400).send({ error: 'File upload failed', details: err.message });
    }
    if (!data) return reply.status(400).send({ error: 'No file uploaded. Field name must be "file".' });

    const buffer = await data.toBuffer();

    try {
      const result = await scanQRCode(buffer);
      const duration = Date.now() - startTime;

      logHistory(project.id, {
        operation: 'scan',
        content_preview: result.data || null,
        data_length: result.data ? result.data.length : 0,
        image_width: result.image?.width,
        image_height: result.image?.height,
        scan_success: result.success,
        scan_duration_ms: result.duration_ms,
        duration_ms: duration,
        status: result.success ? 'success' : 'failed',
        error_message: result.success ? null : result.error,
        client_ip: request.ip,
        user_agent: request.headers['user-agent'],
      });

      if (!result.success) {
        return reply.status(422).send({
          success: false,
          error: result.error,
          duration_ms: duration,
        });
      }

      return reply.send({
        success: true,
        data: result.data,
        data_length: result.data.length,
        image: result.image,
        location: result.location,
        duration_ms: duration,
      });
    } catch (error) {
      logHistory(project.id, {
        operation: 'scan',
        duration_ms: Date.now() - startTime,
        status: 'failed',
        error_message: error.message,
        client_ip: request.ip,
      });
      return reply.status(500).send({ error: 'Scan failed', details: error.message });
    }
  });
}
