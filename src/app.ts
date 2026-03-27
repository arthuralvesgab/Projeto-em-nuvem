import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import systemRoutes from './routes/system';
import { env } from './config/env';

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
    const server = Fastify({
        logger: true,
        ...options
    });

    server.register(cors, {
        origin: env.corsOrigin,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    });

    server.setErrorHandler((error, request, reply) => {
        request.log.error(error);

        if (reply.sent) {
            return;
        }

        const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
        return reply.code(statusCode).send({
            error: error.message || 'Erro interno do servidor.',
            statusCode
        });
    });

    server.setNotFoundHandler((request, reply) => {
        return reply.code(404).send({
            error: `Rota ${request.method} ${request.url} nao encontrada.`,
            statusCode: 404
        });
    });

    server.register(swagger, {
        swagger: {
            info: {
                title: 'TaskFlow API',
                description: [
                    'API REST para autenticacao, usuarios, projetos e tarefas.',
                    '',
                    'Como usar:',
                    '1. Gere um token no Firebase Auth.',
                    '2. Envie no header Authorization como Bearer <token>.',
                    '3. Teste os endpoints por grupo abaixo.'
                ].join('\n'),
                version: '2.0.0'
            },
            host: 'localhost:5000',
            schemes: ['http'],
            consumes: ['application/json'],
            produces: ['application/json'],
            securityDefinitions: {
                bearerAuth: {
                    type: 'apiKey',
                    name: 'Authorization',
                    in: 'header',
                    description: 'Informe: Bearer <seu_token>'
                }
            },
            tags: [
                {
                    name: 'Sistema',
                    description: 'Endpoints de verificacao da API.'
                },
                {
                    name: 'Autenticacao',
                    description: 'Perfil e sessao do usuario autenticado.'
                },
                {
                    name: 'Usuarios',
                    description: 'CRUD de usuarios.'
                },
                {
                    name: 'Projetos',
                    description: 'CRUD de projetos.'
                },
                {
                    name: 'Tarefas',
                    description: 'CRUD de tarefas e atualizacoes rapidas.'
                }
            ]
        }
    });

    server.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: false,
            defaultModelsExpandDepth: 1,
            displayRequestDuration: true
        },
        staticCSP: true,
        transformSpecificationClone: true
    });

    server.register(systemRoutes);
    server.register(authRoutes, { prefix: '/v1' });
    server.register(usersRoutes, { prefix: '/v1' });
    server.register(projectsRoutes, { prefix: '/v1' });
    server.register(tasksRoutes, { prefix: '/v1' });

    return server;
}
