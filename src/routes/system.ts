import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
    fastify.get('/health', {
        schema: {
            tags: ['Sistema'],
            summary: 'Verificar status da API',
            description: 'Usa este endpoint para confirmar se o back-end esta online.',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'ok' },
                        timestamp: { type: 'string', example: '2026-03-21T12:00:00.000Z' }
                    }
                }
            }
        }
    }, async () => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString()
        };
    });
}
