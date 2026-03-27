import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app';
import { setFirebaseServices } from '../src/plugins/firebase';
import { refreshEnv } from '../src/config/env';

type DocData = Record<string, any>;

class FakeDocSnapshot {
    constructor(public id: string, private value: DocData | undefined) {}

    get exists() {
        return this.value !== undefined;
    }

    data() {
        return this.value;
    }
}

class FakeDocRef {
    constructor(private store: Map<string, DocData>, public id: string) {}

    async get() {
        return new FakeDocSnapshot(this.id, this.store.get(this.id));
    }

    async set(data: DocData, options?: { merge?: boolean }) {
        const current = this.store.get(this.id);
        this.store.set(this.id, options?.merge && current ? { ...current, ...data } : { ...data });
    }

    async update(data: DocData) {
        const current = this.store.get(this.id);
        if (!current) {
            throw new Error(`Document ${this.id} not found`);
        }
        this.store.set(this.id, { ...current, ...data });
    }

    async delete() {
        this.store.delete(this.id);
    }
}

class FakeQuerySnapshot {
    constructor(public docs: Array<{ id: string; data: () => DocData; ref: FakeDocRef }>) {}
}

class FakeQuery {
    constructor(
        private store: Map<string, DocData>,
        private filters: Array<{ field: string; op: string; value: any }> = []
    ) {}

    where(field: string, op: string, value: any) {
        return new FakeQuery(this.store, [...this.filters, { field, op, value }]);
    }

    async get() {
        const docs = [...this.store.entries()]
            .filter(([, data]) => this.matches(data))
            .map(([id, data]) => ({
                id,
                data: () => data,
                ref: new FakeDocRef(this.store, id)
            }));
        return new FakeQuerySnapshot(docs);
    }

    private matches(data: DocData) {
        return this.filters.every(({ field, op, value }) => {
            const fieldValue = data[field];
            if (op === '==') return fieldValue === value;
            if (op === 'array-contains') return Array.isArray(fieldValue) && fieldValue.includes(value);
            throw new Error(`Unsupported operator: ${op}`);
        });
    }
}

class FakeCollectionRef extends FakeQuery {
    private sequence = 0;

    constructor(private store: Map<string, DocData>) {
        super(store);
    }

    doc(id: string) {
        return new FakeDocRef(this.store, id);
    }

    async add(data: DocData) {
        this.sequence += 1;
        const id = `doc-${this.sequence}`;
        this.store.set(id, { ...data });
        return new FakeDocRef(this.store, id);
    }
}

class FakeFirestore {
    private collections = new Map<string, Map<string, DocData>>();

    constructor(seed: Record<string, Record<string, DocData>> = {}) {
        Object.entries(seed).forEach(([name, docs]) => {
            this.collections.set(name, new Map(Object.entries(docs)));
        });
    }

    collection(name: string) {
        if (!this.collections.has(name)) {
            this.collections.set(name, new Map());
        }
        return new FakeCollectionRef(this.collections.get(name)!);
    }

    batch() {
        const operations: Array<() => Promise<void>> = [];
        return {
            delete: (ref: FakeDocRef) => {
                operations.push(() => ref.delete());
            },
            commit: async () => {
                for (const operation of operations) {
                    await operation();
                }
            }
        };
    }
}

class FakeAuth {
    async verifyIdToken() {
        throw new Error('verifyIdToken should not be used in these tests');
    }

    async setCustomUserClaims() {
        return;
    }
}

function createTestApp(seed: Record<string, Record<string, DocData>> = {}) {
    const db = new FakeFirestore(seed);
    const auth = new FakeAuth();
    setFirebaseServices({ db: db as any, auth: auth as any });

    const previousNodeEnv = process.env.NODE_ENV;
    const previousDevAdmin = process.env.DEV_ADMIN;
    const previousDevMember = process.env.DEV_MEMBER;

    process.env.NODE_ENV = 'development';
    process.env.DEV_ADMIN = 'DEV_ADMIN';
    process.env.DEV_MEMBER = 'DEV_MEMBER';
    refreshEnv();

    const app = buildApp({ logger: false });

    async function close() {
        await app.close();
        process.env.NODE_ENV = previousNodeEnv;
        process.env.DEV_ADMIN = previousDevAdmin;
        process.env.DEV_MEMBER = previousDevMember;
        refreshEnv();
    }

    return { app, db, close };
}

test('GET /health returns API status', async () => {
    const { app, close } = createTestApp();

    try {
        const response = await app.inject({
            method: 'GET',
            url: '/health'
        });

        assert.equal(response.statusCode, 200);
        const body = response.json();
        assert.equal(body.status, 'ok');
        assert.ok(body.timestamp);
    } finally {
        await close();
    }
});

test('GET /v1/auth/me returns authenticated user data', async () => {
    const { app, close } = createTestApp({
        users: {
            'dev-member-123': {
                name: 'Membro',
                email: 'member@example.com',
                role: 'member',
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z'
            }
        }
    });

    try {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/auth/me',
            headers: {
                authorization: 'Bearer DEV_MEMBER'
            }
        });

        assert.equal(response.statusCode, 200);
        const body = response.json();
        assert.equal(body.id, 'dev-member-123');
        assert.equal(body.role, 'member');
        assert.equal(body.profile.email, 'member@example.com');
    } finally {
        await close();
    }
});

test('unknown route returns standard error payload', async () => {
    const { app, close } = createTestApp();

    try {
        const response = await app.inject({
            method: 'GET',
            url: '/rota-inexistente'
        });

        assert.equal(response.statusCode, 404);
        assert.deepEqual(response.json(), {
            error: 'Rota GET /rota-inexistente nao encontrada.',
            statusCode: 404
        });
    } finally {
        await close();
    }
});

test('GET /v1/projects requires authentication', async () => {
    const { app, close } = createTestApp();

    try {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/projects'
        });

        assert.equal(response.statusCode, 401);
        assert.deepEqual(response.json(), {
            error: 'Token de autenticacao ausente ou invalido.'
        });
    } finally {
        await close();
    }
});

test('project owner can update and delete a project with its tasks', async () => {
    const { app, db, close } = createTestApp({
        projects: {
            'project-1': {
                name: 'Projeto inicial',
                description: 'Descricao antiga',
                members: ['dev-member-123'],
                ownerId: 'dev-member-123',
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z'
            }
        },
        tasks: {
            'task-1': {
                title: 'Tarefa vinculada',
                projectId: 'project-1',
                status: 'todo',
                createdBy: 'dev-member-123',
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z'
            }
        }
    });

    try {
        const updateResponse = await app.inject({
            method: 'PUT',
            url: '/v1/projects/project-1',
            headers: {
                authorization: 'Bearer DEV_MEMBER'
            },
            payload: {
                name: 'Projeto atualizado',
                members: ['dev-member-123', 'colaborador-1']
            }
        });

        assert.equal(updateResponse.statusCode, 200);
        assert.equal(updateResponse.json().project.name, 'Projeto atualizado');
        assert.deepEqual(updateResponse.json().project.members, ['dev-member-123', 'colaborador-1']);

        const deleteResponse = await app.inject({
            method: 'DELETE',
            url: '/v1/projects/project-1',
            headers: {
                authorization: 'Bearer DEV_MEMBER'
            }
        });

        assert.equal(deleteResponse.statusCode, 200);
        assert.equal(deleteResponse.json().message, 'Projeto removido com sucesso.');

        const projectsSnapshot = await db.collection('projects').get();
        const tasksSnapshot = await db.collection('tasks').get();
        assert.equal(projectsSnapshot.docs.length, 0);
        assert.equal(tasksSnapshot.docs.length, 0);
    } finally {
        await close();
    }
});

test('member can create and update a task inside own project', async () => {
    const { app, close } = createTestApp({
        projects: {
            'project-1': {
                name: 'Projeto',
                description: '',
                members: ['dev-member-123', 'member-2'],
                ownerId: 'dev-member-123',
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z'
            }
        }
    });

    try {
        const createResponse = await app.inject({
            method: 'POST',
            url: '/v1/tasks',
            headers: {
                authorization: 'Bearer DEV_MEMBER'
            },
            payload: {
                title: 'Nova tarefa',
                description: 'Detalhes',
                projectId: 'project-1',
                assignedTo: 'member-2'
            }
        });

        assert.equal(createResponse.statusCode, 201);
        const taskId = createResponse.json().id;
        assert.ok(taskId);

        const updateResponse = await app.inject({
            method: 'PUT',
            url: `/v1/tasks/${taskId}`,
            headers: {
                authorization: 'Bearer DEV_MEMBER'
            },
            payload: {
                status: 'done',
                title: 'Nova tarefa finalizada'
            }
        });

        assert.equal(updateResponse.statusCode, 200);
        const body = updateResponse.json();
        assert.equal(body.task.status, 'done');
        assert.equal(body.task.title, 'Nova tarefa finalizada');
    } finally {
        await close();
    }
});

test('task creation rejects assignee outside the project', async () => {
    const { app, close } = createTestApp({
        projects: {
            'project-1': {
                name: 'Projeto',
                description: '',
                members: ['dev-member-123'],
                ownerId: 'dev-member-123',
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z'
            }
        }
    });

    try {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/tasks',
            headers: {
                authorization: 'Bearer DEV_MEMBER'
            },
            payload: {
                title: 'Nova tarefa',
                projectId: 'project-1',
                assignedTo: 'outsider'
            }
        });

        assert.equal(response.statusCode, 400);
        assert.deepEqual(response.json(), {
            error: 'O usuario atribuido precisa fazer parte do projeto.'
        });
    } finally {
        await close();
    }
});

test('admin can create, read, update and delete users', async () => {
    const { app, close } = createTestApp({
        users: {
            'dev-admin-123': {
                name: 'Admin',
                email: 'admin@example.com',
                role: 'admin',
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z'
            }
        }
    });

    try {
        const createResponse = await app.inject({
            method: 'POST',
            url: '/v1/users',
            headers: {
                authorization: 'Bearer DEV_ADMIN'
            },
            payload: {
                name: 'Novo usuario',
                email: 'novo@example.com'
            }
        });

        assert.equal(createResponse.statusCode, 201);
        const userId = createResponse.json().id;
        assert.ok(userId);

        const getResponse = await app.inject({
            method: 'GET',
            url: `/v1/users/${userId}`,
            headers: {
                authorization: 'Bearer DEV_ADMIN'
            }
        });

        assert.equal(getResponse.statusCode, 200);
        assert.equal(getResponse.json().email, 'novo@example.com');

        const updateResponse = await app.inject({
            method: 'PUT',
            url: `/v1/users/${userId}`,
            headers: {
                authorization: 'Bearer DEV_ADMIN'
            },
            payload: {
                name: 'Usuario atualizado',
                role: 'admin'
            }
        });

        assert.equal(updateResponse.statusCode, 200);
        assert.equal(updateResponse.json().user.name, 'Usuario atualizado');
        assert.equal(updateResponse.json().user.role, 'admin');

        const deleteResponse = await app.inject({
            method: 'DELETE',
            url: `/v1/users/${userId}`,
            headers: {
                authorization: 'Bearer DEV_ADMIN'
            }
        });

        assert.equal(deleteResponse.statusCode, 200);
        assert.equal(deleteResponse.json().message, 'Usuario removido com sucesso.');
    } finally {
        await close();
    }
});

test('member cannot create users', async () => {
    const { app, close } = createTestApp();

    try {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/users',
            headers: {
                authorization: 'Bearer DEV_MEMBER'
            },
            payload: {
                name: 'Bloqueado',
                email: 'bloqueado@example.com'
            }
        });

        assert.equal(response.statusCode, 403);
        assert.deepEqual(response.json(), {
            error: 'Somente administradores podem criar usuarios.'
        });
    } finally {
        await close();
    }
});
