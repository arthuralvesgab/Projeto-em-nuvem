# Integracao Front-end

Base URL local:

- `http://localhost:5000`

Base URL em producao:

- URL publica do Render ou Railway

## Headers padrao

- `Content-Type: application/json`
- `Authorization: Bearer <firebase-id-token>`

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

## Exemplo com fetch

```ts
const API_URL = import.meta.env.VITE_API_URL;

export async function apiFetch(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Falha na requisicao');
  }

  return data;
}
```

## Exemplo com axios

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
```

## Formato de erro

Quando a requisicao falha, a API retorna JSON no formato:

```json
{
  "error": "Mensagem do erro",
  "statusCode": 400
}
```

## Variaveis recomendadas no front-end

- `VITE_API_URL=http://localhost:5000`
- `NEXT_PUBLIC_API_URL=http://localhost:5000`

## Variaveis usadas no back-end

- `PORT`
- `HOST`
- `NODE_ENV`
- `CORS_ORIGIN`
- `ROOT_ADMIN_EMAIL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `DEV_ADMIN`
- `DEV_MEMBER`
