import { buildApp } from './app';
import { env } from './config/env';

const server = buildApp();

const start = async () => {
    try {
        const port = env.port;
        const host = env.host;

        await server.listen({ port, host });

        console.log(`Servidor rodando na porta ${port}`);
        console.log(`Documentacao local: http://localhost:${port}/docs`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

if (require.main === module) {
    start();
}
