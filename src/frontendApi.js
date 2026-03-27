export const DEFAULT_API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
  "http://localhost:5000";

export const DEV_MEMBER_TOKEN = "DEV_MEMBER";
export const TOKEN_STORAGE_KEY = "taskflow-token";

export function getStoredToken(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!storage) return DEV_MEMBER_TOKEN;
  return storage.getItem(TOKEN_STORAGE_KEY) || DEV_MEMBER_TOKEN;
}

export function createTaskFlowClient({
  apiUrl = DEFAULT_API_URL,
  token,
  fetchImpl = (...args) => fetch(...args)
} = {}) {
  async function apiFetch(path, options = {}) {
    const hasBody = options.body !== undefined;
    const response = await fetchImpl(`${apiUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || "Falha na requisicao.");
    }

    return data;
  }

  return {
    apiFetch,
    getSession() {
      return apiFetch("/v1/auth/me");
    },
    listProjects() {
      return apiFetch("/v1/projects");
    },
    createDefaultProject() {
      return apiFetch("/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          name: "Projeto pessoal",
          description: "Projeto criado automaticamente para o painel web."
        })
      });
    },
    async ensureProject() {
      const projects = await this.listProjects();

      if (Array.isArray(projects) && projects.length > 0) {
        return projects;
      }

      const created = await this.createDefaultProject();
      return [
        {
          id: created.id,
          name: "Projeto pessoal",
          description: "Projeto criado automaticamente para o painel web."
        }
      ];
    },
    listTasks(projectId) {
      const params = new URLSearchParams({ projectId });
      return apiFetch(`/v1/tasks?${params.toString()}`);
    },
    createTask({ title, description, projectId }) {
      return apiFetch("/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          projectId
        })
      });
    },
    updateTaskStatus(id, status) {
      return apiFetch(`/v1/tasks/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
    },
    deleteTask(id) {
      return apiFetch(`/v1/tasks/${id}`, {
        method: "DELETE"
      });
    }
  };
}
