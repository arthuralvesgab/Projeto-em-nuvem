import { FastifyInstance } from 'fastify';
import { db, auth } from '../plugins/firebase';
import { verifyToken } from '../controllers/authController';

export default async function (fastify: FastifyInstance) {
    fastify.get('/auth/me', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Autenticacao'],
            description: 'Retorna o usuario autenticado.',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        role: { type: 'string' },
                        profile: { type: ['object', 'null'], additionalProperties: true }
                    }
                }
            }
        }
    }, async (request) => {
        const user = (request as any).user;
        const userDoc = await db.collection('users').doc(user.uid).get();

        return {
            id: user.uid,
            role: user.role,
            profile: userDoc.exists ? userDoc.data() : null
        };
    });

    fastify.post('/auth/profile', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Autenticacao'],
            description: 'Cria ou atualiza o perfil do usuario autenticado.',
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    role: { type: 'string', enum: ['admin', 'member'] },
                    name: { type: 'string' },
                    email: { type: 'string' }
                }
            }
        }
    }, async (request) => {
        const user = (request as any).user;
        const { role, name, email } = request.body as any;

        const updateData: any = {
            name,
            updatedAt: new Date().toISOString()
        };

        if (role) updateData.role = role;
        if (email) updateData.email = email;

        await db.collection('users').doc(user.uid).set(updateData, { merge: true });

        if (role) {
            await auth.setCustomUserClaims(user.uid, { role });
        }

        return {
            message: 'Perfil salvo com sucesso.',
            role: role || user.role
        };
    });
}
