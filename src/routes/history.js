import { listHistory } from '../db.js';

export default async function historyRoutes(fastify) {
  fastify.get('/qr/history', async (request) => {
    const project = request.project;
    const q = request.query;

    const limit = Math.min(parseInt(q.limit || '20'), 100);
    const offset = parseInt(q.offset || '0');

    const { entries, total } = listHistory(project.id, {
      operation: q.operation,
      preset: q.preset,
      status: q.status,
      search: q.search,
      from_date: q.from_date ? parseInt(q.from_date) : undefined,
      to_date: q.to_date ? parseInt(q.to_date) : undefined,
      limit,
      offset,
    });

    return {
      success: true,
      entries,
      pagination: { total, limit, offset, has_more: offset + entries.length < total },
    };
  });
}
