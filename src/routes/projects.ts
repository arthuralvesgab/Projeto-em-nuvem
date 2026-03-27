import { FastifyInstance } from 'fastify';
import { db } from '../plugins/firebase';
import { verifyToken } from '../controllers/authController';

export default async function (fastify: FastifyInstance) {
    fastify.post('/projects', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Projetos'],
            description: 'Cria um novo projeto.',
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    members: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { name, description, members = [] } = request.body as any;
        const dedupedMembers = Array.from(new Set([user.uid, ...members]));
        const timestamp = new Date().toISOString();

        const docRef = await db.collection('projects').add({
            name,
            description: description || '',
            members: dedupedMembers,
            ownerId: user.uid,
            createdAt: timestamp,
            updatedAt: timestamp
        });

        return reply.code(201).send({ id: docRef.id, message: 'Projeto criado com sucesso.' });
    });

    fastify.get('/projects', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Projetos'],
            description: 'Lista os projetos do usuario autenticado.'
        }
    }, async (request) => {
        const user = (request as any).user;
        const snapshot = await db.collection('projects')
            .where('members', 'array-contains', user.uid)
            .get();

        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
    });

    fastify.get('/projects/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Projetos'],
            description: 'Busca um projeto por identificador.',
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
        const projectDoc = await db.collection('projects').doc(id).get();

        if (!projectDoc.exists) {
            return reply.code(404).send({ error: 'Projeto nao encontrado.' });
        }

        const project = projectDoc.data() as any;
        if (!project.members?.includes(user.uid) && user.role !== 'admin') {
            return reply.code(403).send({ error: 'Acesso negado ao projeto.' });
        }

        return {
            id: projectDoc.id,
            ...project
        };
    });

    fastify.put('/projects/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Projetos'],
            description: 'Atualiza um projeto existente.',
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
                    description: { type: 'string' },
                    members: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { id } = request.params as any;
        const { name, description, members } = request.body as any;
        const projectRef = db.collection('projects').doc(id);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
            return reply.code(404).send({ error: 'Projeto nao encontrado.' });
        }

        const project = projectDoc.data() as any;
        const canManage = project.ownerId === user.uid || user.role === 'admin';
        if (!canManage) {
            return reply.code(403).send({ error: 'Somente o dono do projeto ou um admin pode altera-lo.' });
        }

        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString()
        };

        if (typeof name === 'string') updateData.name = name;
        if (typeof description === 'string') updateData.description = description;
        if (Array.isArray(members)) {
            updateData.members = Array.from(new Set([project.ownerId, ...members]));
        }

        await projectRef.update(updateData);

        const updatedDoc = await projectRef.get();
        return {
            message: 'Projeto atualizado com sucesso.',
            project: {
                id: updatedDoc.id,
                ...updatedDoc.data()
            }
        };
    });

    fastify.delete('/projects/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Projetos'],
            description: 'Remove um projeto e suas tarefas.',
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
        const projectRef = db.collection('projects').doc(id);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
            return reply.code(404).send({ error: 'Projeto nao encontrado.' });
        }

        const project = projectDoc.data() as any;
        const canManage = project.ownerId === user.uid || user.role === 'admin';
        if (!canManage) {
            return reply.code(403).send({ error: 'Somente o dono do projeto ou um admin pode remove-lo.' });
        }

        const tasksSnapshot = await db.collection('tasks').where('projectId', '==', id).get();
        const batch = db.batch();

        tasksSnapshot.docs.forEach((taskDoc) => {
            batch.delete(taskDoc.ref);
        });
        batch.delete(projectRef);

        await batch.commit();

        return reply.code(200).send({ message: 'Projeto removido com sucesso.' });
    });
}
