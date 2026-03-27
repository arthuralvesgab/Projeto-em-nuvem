# Deploy

O backend esta preparado para deploy em Render ou Railway via `Dockerfile`.

## Variaveis de ambiente obrigatorias

- `NODE_ENV=production`
- `PORT=5000`
- `HOST=0.0.0.0`
- `ROOT_ADMIN_EMAIL=seu-email-admin`
- `FIREBASE_SERVICE_ACCOUNT_JSON={json da service account em uma linha}`

## Render

1. Crie um Web Service apontando para este repositorio.
2. O `render.yaml` configura deploy automatico e health check em `/health`.
3. Adicione as variaveis de ambiente obrigatorias.
4. Publique e valide `/health` e `/docs`.

## Railway

1. Crie um novo projeto e conecte este repositorio.
2. Mantenha o deploy via `Dockerfile`.
3. Adicione as mesmas variaveis de ambiente.
4. Publique e valide `/health` e `/docs`.
