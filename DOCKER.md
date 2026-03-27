# Docker

O backend esta configurado para rodar com Docker em desenvolvimento e em modo de producao.

## Desenvolvimento

Use:

```bash
docker compose up --build
```

Isso sobe a API com hot reload em `http://localhost:5000`.

Observacoes:

- o arquivo `.env` e carregado automaticamente
- a credencial local do Firebase esta mapeada para dentro do container
- o codigo fonte fica montado em volume para refletir alteracoes sem rebuild manual

## Producao local

Use:

```bash
docker compose -f docker-compose.prod.yml up --build
```

Isso gera a imagem final a partir do `Dockerfile` e sobe a API em modo `production`.

## Variaveis importantes

- `PORT`
- `HOST`
- `NODE_ENV`
- `ROOT_ADMIN_EMAIL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`

Para deploy em nuvem, prefira `FIREBASE_SERVICE_ACCOUNT_JSON` em vez de montar arquivo local.
