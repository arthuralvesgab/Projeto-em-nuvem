import { FastifyInstance } from 'fastify';
import { db } from '../plugins/firebase';
import { verifyToken } from '../controllers/authController';

const allowedStatus = ['todo', 'in_progress', 'done'];

export default async function (fastify: FastifyInstance) {
    fastify.post('/tasks', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Tarefas'],
            description: 'Cria uma nova tarefa vinculada a um projeto.',
            body: {
                type: 'object',
                required: ['title', 'projectId'],
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    projectId: { type: 'string' },
                    assignedTo: { type: 'string' },
                    status: { type: 'string', enum: allowedStatus }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { title, description, projectId, assignedTo, status } = request.body as any;
        const projectDoc = await db.collection('projects').doc(projectId).get();

        if (!projectDoc.exists) {
            return reply.code(404).send({ error: 'Projeto nao encontrado.' });
        }

        const project = projectDoc.data() as any;
        if (!project.members?.includes(user.uid) && user.role !== 'admin') {
            return reply.code(403).send({ error: 'Acesso negado ao projeto.' });
        }

        if (assignedTo && !project.members?.includes(assignedTo)) {
            return reply.code(400).send({ error: 'O usuario atribuido precisa fazer parte do projeto.' });
        }

        const timestamp = new Date().toISOString();
        const docRef = await db.collection('tasks').add({
            title,
            description: description || '',
            projectId,
            assignedTo: assignedTo || null,
            status: status || 'todo',
            createdBy: user.uid,
            createdAt: timestamp,
            updatedAt: timestamp
        });

        return reply.code(201).send({ id: docRef.id, message: 'Tarefa criada com sucesso.' });
    });

    fastify.get('/tasks', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Tarefas'],
            description: 'Lista tarefas por projeto, status ou usuario responsavel.',
            querystring: {
                type: 'object',
                properties: {
                    projectId: { type: 'string' },
                    status: { type: 'string', enum: allowedStatus },
                    assignedTo: { type: 'string' }
                }
            }
        }
    }, async (request) => {
        const user = (request as any).user;
        const { projectId, status, assignedTo } = request.query as any;
        let query: FirebaseFirestore.Query = db.collection('tasks');

        if (projectId) query = query.where('projectId', '==', projectId);
        if (status) query = query.where('status', '==', status);
        if (assignedTo) query = query.where('assignedTo', '==', assignedTo);

        const snapshot = await query.get();
        const tasks = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        })) as any[];

        if (user.role === 'admin') {
            return tasks;
        }

        const projectIds = Array.from(new Set(tasks.map((task) => task.projectId)));
        const allowedProjects = new Set<string>();

        for (const id of projectIds) {
            const projectDoc = await db.collection('projects').doc(id).get();
            const project = projectDoc.data() as any;
            if (project?.members?.includes(user.uid)) {
                allowedProjects.add(id);
            }
        }

        return tasks.filter((task) => allowedProjects.has(task.projectId));
    });

    fastify.get('/tasks/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Tarefas'],
            description: 'Busca uma tarefa por identificador.',
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
        const taskDoc = await db.collection('tasks').doc(id).get();

        if (!taskDoc.exists) {
            return reply.code(404).send({ error: 'Tarefa nao encontrada.' });
        }

        const task = taskDoc.data() as any;
        const projectDoc = await db.collection('projects').doc(task.projectId).get();
        const project = projectDoc.data() as any;

        if (!project?.members?.includes(user.uid) && user.role !== 'admin') {
            return reply.code(403).send({ error: 'Acesso negado a tarefa.' });
        }

        return {
            id: taskDoc.id,
            ...task
        };
    });

    fastify.put('/tasks/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Tarefas'],
            description: 'Atualiza os dados principais de uma tarefa.',
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
                    title: { type: 'string' },
                    description: { type: 'string' },
                    assignedTo: { type: 'string' },
                    status: { type: 'string', enum: allowedStatus }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { id } = request.params as any;
        const { title, description, assignedTo, status } = request.body as any;
        const taskRef = db.collection('tasks').doc(id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            return reply.code(404).send({ error: 'Tarefa nao encontrada.' });
        }

        const task = taskDoc.data() as any;
        const projectDoc = await db.collection('projects').doc(task.projectId).get();
        const project = projectDoc.data() as any;

        if (!project?.members?.includes(user.uid) && user.role !== 'admin') {
            return reply.code(403).send({ error: 'Acesso negado a tarefa.' });
        }

        if (assignedTo && !project?.members?.includes(assignedTo)) {
            return reply.code(400).send({ error: 'O usuario informado nao pertence ao projeto.' });
        }

        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString()
        };

        if (typeof title === 'string') updateData.title = title;
        if (typeof description === 'string') updateData.description = description;
        if (typeof assignedTo === 'string') updateData.assignedTo = assignedTo;
        if (typeof status === 'string') updateData.status = status;

        await taskRef.update(updateData);

        const updatedDoc = await taskRef.get();
        return {
            message: 'Tarefa atualizada com sucesso.',
            task: {
                id: updatedDoc.id,
                ...updatedDoc.data()
            }
        };
    });

    fastify.put('/tasks/:id/status', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Tarefas'],
            description: 'Altera o status de uma tarefa.',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                required: ['status'],
                properties: {
                    status: { type: 'string', enum: allowedStatus }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { id } = request.params as any;
        const { status } = request.body as any;
        const taskRef = db.collection('tasks').doc(id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            return reply.code(404).send({ error: 'Tarefa nao encontrada.' });
        }

        const task = taskDoc.data() as any;
        const projectDoc = await db.collection('projects').doc(task.projectId).get();
        const project = projectDoc.data() as any;

        if (!project?.members?.includes(user.uid) && user.role !== 'admin') {
            return reply.code(403).send({ error: 'Acesso negado a tarefa.' });
        }

        await taskRef.update({
            status,
            updatedAt: new Date().toISOString()
        });

        return { message: 'Status da tarefa atualizado com sucesso.' };
    });

    fastify.put('/tasks/:id/assign', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Tarefas'],
            description: 'Atribui uma tarefa a um usuario.',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                required: ['assignedTo'],
                properties: {
                    assignedTo: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const user = (request as any).user;
        const { id } = request.params as any;
        const { assignedTo } = request.body as any;
        const taskRef = db.collection('tasks').doc(id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            return reply.code(404).send({ error: 'Tarefa nao encontrada.' });
        }

        const task = taskDoc.data() as any;
        const projectDoc = await db.collection('projects').doc(task.projectId).get();
        const project = projectDoc.data() as any;

        if (!project?.members?.includes(user.uid) && user.role !== 'admin') {
            return reply.code(403).send({ error: 'Acesso negado a tarefa.' });
        }

        if (!project?.members?.includes(assignedTo)) {
            return reply.code(400).send({ error: 'O usuario informado nao pertence ao projeto.' });
        }

        await taskRef.update({
            assignedTo,
            updatedAt: new Date().toISOString()
        });

        return { message: 'Tarefa atribuida com sucesso.' };
    });

    fastify.delete('/tasks/:id', {
        preHandler: [verifyToken],
        schema: {
            tags: ['Tarefas'],
            description: 'Remove uma tarefa.',
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
        const taskRef = db.collection('tasks').doc(id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            return reply.code(404).send({ error: 'Tarefa nao encontrada.' });
        }

        const task = taskDoc.data() as any;
        const projectDoc = await db.collection('projects').doc(task.projectId).get();
        const project = projectDoc.data() as any;

        if (!project?.members?.includes(user.uid) && user.role !== 'admin') {
            return reply.code(403).send({ error: 'Acesso negado a tarefa.' });
        }

        await taskRef.delete();

        return { message: 'Tarefa removida com sucesso.' };
    });
}
