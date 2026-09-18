import { listPresets } from '../qr/presets.js';

export default async function presetRoutes(fastify) {
  fastify.get('/qr/presets', async () => {
    const presets = listPresets();
    return {
      success: true,
      presets,
      count: presets.length,
    };
  });
}
