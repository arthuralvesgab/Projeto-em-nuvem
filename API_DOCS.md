# Documentacao da API

Swagger UI:

- `http://localhost:5000/docs`

## Como autenticar

Quase todas as rotas usam o header:

```http
Authorization: Bearer <token>
```

Em ambiente local, voce pode usar:

- `DEV_ADMIN`
- `DEV_MEMBER`

## Ordem recomendada para testar

1. `GET /health`
2. `GET /v1/auth/me`
3. `POST /v1/auth/profile`
4. `GET /v1/projects`
5. `POST /v1/projects`
6. `GET /v1/tasks`
7. `POST /v1/tasks`

## Grupos da API

- `Sistema`: verifica se a API esta online.
- `Autenticacao`: consulta o usuario logado e salva perfil.
- `Usuarios`: cria, lista, busca, atualiza e remove usuarios.
- `Projetos`: cria, lista, busca, atualiza e remove projetos.
- `Tarefas`: cria, lista, busca, atualiza e remove tarefas.

## Respostas de erro

Quando houver erro, a API retorna:

```json
{
  "error": "Mensagem do erro",
  "statusCode": 400
}
```

## Observacao

Se o front-end estiver em outra porta, configure `CORS_ORIGIN` no `.env`.
