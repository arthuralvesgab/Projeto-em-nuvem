# TaskFlow API

API REST para autenticacao, usuarios, projetos e tarefas, desenvolvida com Fastify e Firebase Admin.

## Visao geral

Este projeto expoe endpoints para:

- autenticar usuarios
- criar e atualizar perfil
- gerenciar usuarios
- gerenciar projetos
- gerenciar tarefas

A API tambem ja esta preparada para:

- integracao com front-end via `fetch`/HTTP JSON
- execucao com Docker
- deploy em Render ou Railway
- testes automatizados da API e da integracao front-back

## Stack

- Node.js
- TypeScript
- Fastify
- Firebase Admin
- Docker

## Estrutura

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── plugins/
│   └── routes/
├── test/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
└── render.yaml
```

## Requisitos

- Node.js 20+
- npm
- conta Firebase com service account

Opcional:

- Docker Desktop

## Variaveis de ambiente

Use o arquivo `.env.example` como base.

Principais variaveis:

- `PORT=5000`
- `HOST=0.0.0.0`
- `NODE_ENV=development`
- `CORS_ORIGIN=http://localhost:3000,http://localhost:5173`
- `ROOT_ADMIN_EMAIL=seu-email-admin`
- `FIREBASE_SERVICE_ACCOUNT_JSON={json em uma linha}`
- `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json`
- `DEV_MEMBER=DEV_MEMBER`
- `DEV_ADMIN=DEV_ADMIN`

Para producao, prefira usar `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Rodando localmente

1. Instale as dependencias:

```bash
npm install
```

2. Configure o `.env`

3. Rode em desenvolvimento:

```bash
npm run dev
```

API local:

- [http://localhost:5000/health](http://localhost:5000/health)
- [http://localhost:5000/docs](http://localhost:5000/docs)

## Testes

Rodar a suite:

```bash
npm test
```

O projeto possui testes para:

- health check
- autenticacao
- usuarios
- projetos
- tarefas
- integracao entre cliente front-end e back-end

## Docker

### Desenvolvimento

```bash
docker compose up --build
```

### Producao local

```bash
docker compose -f docker-compose.prod.yml up --build
```

Validacao realizada neste ambiente:

- `docker build` executado com sucesso
- `docker compose up -d --build` executado com sucesso
- `GET /health` respondendo `status: ok`

Mais detalhes em [DOCKER.md](./DOCKER.md).

## Endpoints principais

- `GET /health`
- `GET /v1/auth/me`
- `POST /v1/auth/profile`
- `GET /v1/users`
- `POST /v1/users`
- `GET /v1/projects`
- `POST /v1/projects`
- `GET /v1/tasks`
- `POST /v1/tasks`

## Integracao com front-end

A API retorna e recebe JSON e usa `Authorization: Bearer <token>`.

Exemplo:

```ts
const response = await fetch("http://localhost:5000/v1/tasks", {
  method: "GET",
  headers: {
    Authorization: "Bearer DEV_MEMBER"
  }
});
```

Mais detalhes em [INTEGRATION.md](./INTEGRATION.md).

## Deploy

O backend esta pronto para deploy com:

- Dockerfile
- `render.yaml`
- configuracao compativel com Render e Railway

Mais detalhes em [DEPLOY.md](./DEPLOY.md).

## Documentacao adicional

- [API_DOCS.md](./API_DOCS.md)
- [INTEGRATION.md](./INTEGRATION.md)
- [DOCKER.md](./DOCKER.md)
- [DEPLOY.md](./DEPLOY.md)

## Status atual

Validado neste workspace:

- API funcionando
- testes automatizados passando
- integracao front-back testada
- Docker do backend testado com sucesso

