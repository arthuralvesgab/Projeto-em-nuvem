import { FastifyInstance } from 'fastify';
import { db } from '../plugins/firebase';
import { verifyToken } from '../controllers/authController';

export default async function (fastify: FastifyInstance) {
    fastify.post('/users', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Usuarios'],
            description: 'Cria um usuario manualmente.',
            body: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                    role: { type: 'string', enum: ['admin', 'member'] }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { name, email, role } = request.body as any;

        if (user.role !== 'admin') {
            return reply.code(403).send({ error: 'Somente administradores podem criar usuarios.' });
        }

        const timestamp = new Date().toISOString();
        const docRef = await db.collection('users').add({
            name,
            email,
            role: role || 'member',
            createdAt: timestamp,
            updatedAt: timestamp
        });

        return reply.code(201).send({
            id: docRef.id,
            message: 'Usuario criado com sucesso.'
        });
    });

    fastify.get('/users', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Usuarios'],
            description: 'Lista usuarios disponiveis para atribuicao de tarefas.'
        }
    }, async () => {
        const snapshot = await db.collection('users').get();

        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
    });

    fastify.get('/users/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Usuarios'],
            description: 'Busca um usuario por identificador.',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { id } = request.params as any;

        if (user.role !== 'admin' && user.uid !== id) {
            return reply.code(403).send({ error: 'Acesso negado ao usuario.' });
        }

        const userDoc = await db.collection('users').doc(id).get();

        if (!userDoc.exists) {
            return reply.code(404).send({ error: 'Usuario nao encontrado.' });
        }

        return {
            id: userDoc.id,
            ...userDoc.data()
        };
    });

    fastify.put('/users/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Usuarios'],
            description: 'Atualiza um usuario.',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                    role: { type: 'string', enum: ['admin', 'member'] }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { id } = request.params as any;
        const { name, email, role } = request.body as any;

        if (user.role !== 'admin' && user.uid !== id) {
            return reply.code(403).send({ error: 'Acesso negado ao usuario.' });
        }

        if (role && user.role !== 'admin') {
            return reply.code(403).send({ error: 'Somente administradores podem alterar a role.' });
        }

        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return reply.code(404).send({ error: 'Usuario nao encontrado.' });
        }

        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString()
        };

        if (typeof name === 'string') updateData.name = name;
        if (typeof email === 'string') updateData.email = email;
        if (typeof role === 'string') updateData.role = role;

        await userRef.update(updateData);

        const updatedDoc = await userRef.get();
        return {
            message: 'Usuario atualizado com sucesso.',
            user: {
                id: updatedDoc.id,
                ...updatedDoc.data()
            }
        };
    });

    fastify.delete('/users/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Usuarios'],
            description: 'Remove um usuario.',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { id } = request.params as any;

        if (user.role !== 'admin') {
            return reply.code(403).send({ error: 'Somente administradores podem remover usuarios.' });
        }

        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return reply.code(404).send({ error: 'Usuario nao encontrado.' });
        }

        await userRef.delete();

        return {
            message: 'Usuario removido com sucesso.'
        };
    });
}
