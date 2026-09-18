import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import pino from 'pino';

import { config } from './config.js';
import { getDatabase } from './db.js';
import { authenticate } from './middleware/auth.js';
import generateRoutes from './routes/generate.js';
import scanRoutes from './routes/scan.js';
import presetRoutes from './routes/presets.js';
import historyRoutes from './routes/history.js';
import statsRoutes from './routes/stats.js';

function buildLogger() {
  try {
    return pino({
      level: config.logLevel,
      transport: config.nodeEnv !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    });
  } catch {
    return pino({ level: config.logLevel });
  }
}

const fastify = Fastify({
  logger: buildLogger(),
  bodyLimit: config.limits.maxImageSizeBytes + 1024 * 1024,
});

await fastify.register(cors, { origin: true });
await fastify.register(helmet, { contentSecurityPolicy: false });
await fastify.register(multipart, {
  limits: {
    fileSize: config.limits.maxImageSizeBytes,
    files: 1,
  },
});

getDatabase();
fastify.log.info('Database initialized');

fastify.register(async (instance) => {
  instance.addHook('preHandler', authenticate);
  instance.register(generateRoutes);
  instance.register(scanRoutes);
  instance.register(presetRoutes);
  instance.register(historyRoutes);
  instance.register(statsRoutes);
});

fastify.get('/health', async () => ({
  service: 'Kode — QR Code Generator & Scanner',
  version: '1.0.0',
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

fastify.get('/', async () => ({
  service: 'Kode',
  description: 'QR code generator & scanner API',
  version: '1.0.0',
  endpoints: {
    'POST /qr/generate': 'Generate QR from raw data',
    'POST /qr/generate/preset': 'Generate QR from preset (wifi, vcard, url, etc.)',
    'POST /qr/generate/batch': 'Batch generate up to 50 QR codes',
    'POST /qr/scan': 'Decode QR from uploaded image (multipart: file)',
    'GET /qr/presets': 'List available presets',
    'GET /qr/history': 'Generation/scan history',
    'GET /qr/stats': 'Usage analytics',
    'GET /health': 'Health check',
  },
  formats: ['png', 'svg', 'datauri', 'json'],
  presets: ['url', 'text', 'wifi', 'vcard', 'email', 'sms', 'tel', 'geo', 'upi', 'momo'],
}));

const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Kode running on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on('SIGINT', async () => { await fastify.close(); process.exit(0); });
process.on('SIGTERM', async () => { await fastify.close(); process.exit(0); });

start();
export default fastify;
