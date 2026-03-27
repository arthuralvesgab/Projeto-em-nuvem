import { useEffect, useMemo, useState } from "react";
import { createTaskFlowClient, DEV_MEMBER_TOKEN, getStoredToken, TOKEN_STORAGE_KEY } from "./frontendApi";

function App() {
  const [token, setToken] = useState(getStoredToken);
  const [perfil, setPerfil] = useState(null);
  const [projetos, setProjetos] = useState([]);
  const [projetoAtivoId, setProjetoAtivoId] = useState("");
  const [tarefas, setTarefas] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const projetoAtivo = useMemo(
    () => projetos.find((projeto) => projeto.id === projetoAtivoId) || null,
    [projetos, projetoAtivoId]
  );

  const tarefasFiltradas = useMemo(() => {
    if (filtroStatus === "all") return tarefas;
    return tarefas.filter((tarefa) => tarefa.status === filtroStatus);
  }, [filtroStatus, tarefas]);

  const client = useMemo(() => createTaskFlowClient({ token }), [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }, [token]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setCarregando(true);
      setErro("");

      try {
        const me = await client.getSession();
        if (!active) return;

        setPerfil(me);

        const loadedProjects = await client.ensureProject();

        if (!active) return;

        setProjetos(loadedProjects);
        setProjetoAtivoId((currentId) => currentId || loadedProjects[0]?.id || "");
      } catch (error) {
        if (!active) return;
        setErro(error.message);
        setProjetos([]);
        setProjetoAtivoId("");
        setTarefas([]);
      } finally {
        if (active) {
          setCarregando(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [client]);

  useEffect(() => {
    if (!projetoAtivoId) return;

    let active = true;

    async function carregarTarefas() {
      setErro("");

      try {
        const data = await client.listTasks(projetoAtivoId);
        if (!active) return;
        setTarefas(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!active) return;
        setErro(error.message);
        setTarefas([]);
      }
    }

    carregarTarefas();

    return () => {
      active = false;
    };
  }, [client, projetoAtivoId]);

  async function adicionarTarefa(event) {
    event.preventDefault();

    if (!titulo.trim() || !projetoAtivoId) return;

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      await client.createTask({
        title: titulo.trim(),
        description: descricao.trim(),
        projectId: projetoAtivoId
      });

      const data = await client.listTasks(projetoAtivoId);
      setTarefas(Array.isArray(data) ? data : []);
      setTitulo("");
      setDescricao("");
      setSucesso("Tarefa salva no back-end com sucesso.");
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarStatus(id, status) {
    setErro("");
    setSucesso("");

    try {
      await client.updateTaskStatus(id, status);

      setTarefas((current) =>
        current.map((tarefa) =>
          tarefa.id === id ? { ...tarefa, status, updatedAt: new Date().toISOString() } : tarefa
        )
      );
      setSucesso("Status sincronizado com o back-end.");
    } catch (error) {
      setErro(error.message);
    }
  }

  async function excluirTarefa(id) {
    setErro("");
    setSucesso("");

    try {
      await client.deleteTask(id);

      setTarefas((current) => current.filter((tarefa) => tarefa.id !== id));
      setSucesso("Tarefa removida do back-end.");
    } catch (error) {
      setErro(error.message);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>TaskFlow conectado</p>
            <h1 style={styles.logo}>Focus Board</h1>
          </div>
          <span style={styles.badge}>{carregando ? "Conectando..." : "API online"}</span>
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Token de acesso</label>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Bearer token"
            style={styles.input}
          />
          <p style={styles.helper}>
            Em desenvolvimento, use <strong>DEV_MEMBER</strong> ou <strong>DEV_ADMIN</strong>.
          </p>
        </div>

        <div style={styles.grid}>
          <div style={styles.panel}>
            <p style={styles.label}>Projeto ativo</p>
            <select
              value={projetoAtivoId}
              onChange={(event) => setProjetoAtivoId(event.target.value)}
              style={styles.input}
              disabled={carregando || projetos.length === 0}
            >
              {projetos.map((projeto) => (
                <option key={projeto.id} value={projeto.id}>
                  {projeto.name}
                </option>
              ))}
            </select>
            <p style={styles.helper}>
              {projetoAtivo?.description || "As tarefas abaixo sao carregadas diretamente da API."}
            </p>
          </div>

          <div style={styles.panel}>
            <p style={styles.label}>Sessao</p>
            <p style={styles.sessionLine}>
              Usuario: <strong>{perfil?.profile?.name || perfil?.profile?.email || perfil?.id || "--"}</strong>
            </p>
            <p style={styles.sessionLine}>
              Perfil: <strong>{perfil?.role || "--"}</strong>
            </p>
          </div>
        </div>

        <div style={styles.section}>
          <form onSubmit={adicionarTarefa} style={styles.form}>
            <input
              type="text"
              placeholder="Titulo da tarefa"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              style={styles.input}
              disabled={carregando || !projetoAtivoId}
            />
            <textarea
              placeholder="Descricao"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              style={styles.textarea}
              disabled={carregando || !projetoAtivoId}
            />
            <button style={styles.button} disabled={salvando || carregando || !projetoAtivoId}>
              {salvando ? "Salvando..." : "Criar tarefa no back-end"}
            </button>
          </form>
        </div>

        <div style={styles.filters}>
          <button onClick={() => setFiltroStatus("all")} style={filterButtonStyle(filtroStatus === "all")}>
            Todas
          </button>
          <button onClick={() => setFiltroStatus("todo")} style={filterButtonStyle(filtroStatus === "todo")}>
            A fazer
          </button>
          <button
            onClick={() => setFiltroStatus("in_progress")}
            style={filterButtonStyle(filtroStatus === "in_progress")}
          >
            Em andamento
          </button>
          <button onClick={() => setFiltroStatus("done")} style={filterButtonStyle(filtroStatus === "done")}>
            Concluidas
          </button>
        </div>

        {erro ? <div style={styles.errorBox}>{erro}</div> : null}
        {sucesso ? <div style={styles.successBox}>{sucesso}</div> : null}

        <div style={styles.list}>
          {tarefasFiltradas.length === 0 ? (
            <div style={styles.emptyState}>
              {carregando ? "Carregando dados do servidor..." : "Nenhuma tarefa encontrada para este filtro."}
            </div>
          ) : (
            tarefasFiltradas.map((tarefa) => (
              <article key={tarefa.id} style={styles.task}>
                <div style={styles.taskBody}>
                  <strong style={styles.taskTitle}>{tarefa.title}</strong>
                  <p style={styles.sub}>{tarefa.description || "Sem descricao"}</p>
                  <p style={styles.sub}>Status atual: {translateStatus(tarefa.status)}</p>
                </div>

                <div style={styles.actions}>
                  {tarefa.status !== "todo" ? null : (
                    <button onClick={() => atualizarStatus(tarefa.id, "in_progress")} style={styles.secondaryAction}>
                      Iniciar
                    </button>
                  )}
                  {tarefa.status === "done" ? null : (
                    <button onClick={() => atualizarStatus(tarefa.id, "done")} style={styles.ok}>
                      Concluir
                    </button>
                  )}
                  <button onClick={() => excluirTarefa(tarefa.id)} style={styles.del}>
                    Excluir
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function translateStatus(status) {
  if (status === "todo") return "A fazer";
  if (status === "in_progress") return "Em andamento";
  if (status === "done") return "Concluida";
  return status;
}

function filterButtonStyle(active) {
  return {
    ...styles.filterBtn,
    background: active ? "#1d4ed8" : "#dbeafe",
    color: active ? "#ffffff" : "#1e3a8a"
  };
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at top, rgba(14,165,233,0.35), transparent 30%), linear-gradient(135deg, #082f49, #164e63 55%, #0f766e)",
    fontFamily: "'Segoe UI', sans-serif"
  },
  card: {
    width: "100%",
    maxWidth: "880px",
    background: "rgba(255,255,255,0.96)",
    borderRadius: "28px",
    padding: "28px",
    boxShadow: "0 24px 80px rgba(8, 47, 73, 0.28)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    marginBottom: "20px"
  },
  eyebrow: {
    margin: 0,
    textTransform: "uppercase",
    fontSize: "12px",
    letterSpacing: "0.12em",
    color: "#0f766e"
  },
  logo: {
    margin: "4px 0 0",
    color: "#082f49",
    fontSize: "32px"
  },
  badge: {
    padding: "10px 14px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "14px",
    fontWeight: 700
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginBottom: "16px"
  },
  panel: {
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "16px"
  },
  section: {
    marginBottom: "16px"
  },
  label: {
    margin: "0 0 8px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155"
  },
  helper: {
    margin: "8px 0 0",
    fontSize: "12px",
    color: "#64748b"
  },
  sessionLine: {
    margin: "4px 0",
    color: "#0f172a"
  },
  form: {
    display: "grid",
    gap: "10px"
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    boxSizing: "border-box"
  },
  textarea: {
    width: "100%",
    minHeight: "92px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box"
  },
  button: {
    padding: "12px 16px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #0284c7, #0f766e)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer"
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "16px"
  },
  filterBtn: {
    padding: "10px 14px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    fontWeight: 700
  },
  errorBox: {
    marginBottom: "12px",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "#fee2e2",
    color: "#991b1b"
  },
  successBox: {
    marginBottom: "12px",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "#dcfce7",
    color: "#166534"
  },
  list: {
    display: "grid",
    gap: "12px"
  },
  emptyState: {
    padding: "18px",
    borderRadius: "18px",
    background: "#eff6ff",
    color: "#1d4ed8",
    textAlign: "center"
  },
  task: {
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start"
  },
  taskBody: {
    flex: 1
  },
  taskTitle: {
    display: "block",
    marginBottom: "6px",
    color: "#0f172a",
    fontSize: "16px"
  },
  sub: {
    margin: "4px 0",
    color: "#475569",
    fontSize: "13px"
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px"
  },
  secondaryAction: {
    padding: "10px 12px",
    background: "#e0f2fe",
    color: "#075985",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer"
  },
  ok: {
    padding: "10px 12px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer"
  },
  del: {
    padding: "10px 12px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer"
  }
};

export default App;
