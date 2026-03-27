import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app';
import { createTaskFlowClient } from '../src/frontendApi.js';
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

function createInjectedFetch(app: ReturnType<typeof buildApp>) {
    return async (url: string, options: Record<string, any> = {}) => {
        const parsedUrl = new URL(url);
        const response = await app.inject({
            method: options.method || 'GET',
            url: `${parsedUrl.pathname}${parsedUrl.search}`,
            headers: options.headers,
            payload: options.body
        });

        return {
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            async json() {
                return response.json();
            }
        };
    };
}

test('front-end client completes the main task flow against the back-end contract', async () => {
    const { app, db, close } = createTestApp({
        users: {
            'dev-member-123': {
                name: 'Membro Front',
                email: 'front@example.com',
                role: 'member',
                createdAt: '2026-03-21T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z'
            }
        }
    });

    try {
        const client = createTaskFlowClient({
            apiUrl: 'http://local.test',
            token: 'DEV_MEMBER',
            fetchImpl: createInjectedFetch(app)
        });

        const session = await client.getSession();
        assert.equal(session.id, 'dev-member-123');
        assert.equal(session.profile.email, 'front@example.com');

        const ensuredProjects = await client.ensureProject();
        assert.equal(ensuredProjects.length, 1);
        assert.equal(ensuredProjects[0].name, 'Projeto pessoal');

        const projectId = ensuredProjects[0].id;
        const createdTask = await client.createTask({
            title: 'Validar integracao',
            description: 'Fluxo criado pelo cliente do front-end',
            projectId
        });

        assert.ok(createdTask.id);

        const listedTasks = await client.listTasks(projectId);
        assert.equal(listedTasks.length, 1);
        assert.equal(listedTasks[0].title, 'Validar integracao');
        assert.equal(listedTasks[0].status, 'todo');

        await client.updateTaskStatus(createdTask.id, 'done');

        const updatedTasks = await client.listTasks(projectId);
        assert.equal(updatedTasks[0].status, 'done');

        await client.deleteTask(createdTask.id);

        const emptyTasks = await client.listTasks(projectId);
        assert.equal(emptyTasks.length, 0);

        const projectsSnapshot = await db.collection('projects').get();
        assert.equal(projectsSnapshot.docs.length, 1);
    } finally {
        await close();
    }
});
