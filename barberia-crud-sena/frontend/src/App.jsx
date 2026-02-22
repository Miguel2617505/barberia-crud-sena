import { useEffect, useMemo, useState } from "react";

/**
 * URL base del backend (API)
 * - Backend corre en: http://localhost:3000
 * - Frontend corre en: http://localhost:5173
 */
const API_URL = "http://localhost:3000";

export default function App() {
  // =========================
  // ESTADO GENERAL (UI)
  // =========================

  // Mensaje simple desde el backend (ruta "/") para verificar conexion
  const [mensaje, setMensaje] = useState("");

  // Lista de citas que viene desde SQLite via API
  const [citas, setCitas] = useState([]);

  // Indicadores de carga / guardado para UX
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mensajes para el usuario (error o confirmacion)
  const [error, setError] = useState("");
  const [msgOk, setMsgOk] = useState("");

  // =========================
  // ESTADO DEL FORMULARIO
  // - Se usa para CREAR y EDITAR
  // =========================

  /**
   * modo:
   * - "crear": el formulario inserta una nueva cita (POST)
   * - "editar": el formulario actualiza una cita existente (PUT)
   */
  const [modo, setModo] = useState("crear");
  const [editId, setEditId] = useState(null);

  // Campos del formulario
  const [cliente, setCliente] = useState("");
  const [servicio, setServicio] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");

  // Titulo dinamico del formulario segun el modo (crear/editar)
  const tituloFormulario = useMemo(() => {
    return modo === "editar" ? `Editar cita #${editId}` : "Crear cita";
  }, [modo, editId]);

  // =========================
  // FUNCIONES AUXILIARES (UI)
  // =========================

  // Limpia mensajes de error/ok para que la UI no quede "sucia"
  const limpiarMensajes = () => {
    setError("");
    setMsgOk("");
  };

  // Limpia los campos del formulario
  const limpiarFormulario = () => {
    setCliente("");
    setServicio("");
    setFecha("");
    setHora("");
  };

  // Vuelve al modo CREAR (sale del modo editar)
  const setModoCrear = () => {
    setModo("crear");
    setEditId(null);
    limpiarFormulario();
  };

  // Validacion basica de campos obligatorios (requisito tipico de evidencia)
  const validarFormulario = () => {
    if (!cliente || !servicio || !fecha || !hora) {
      setError("Completa todos los campos: cliente, servicio, fecha y hora.");
      return false;
    }
    return true;
  };

  // =========================
  // API: OPERACIONES CRUD
  // =========================

  /**
   * READ (Listar)
   * GET /api/citas
   * Trae todas las citas desde SQLite y las guarda en estado.
   */
  const cargarCitas = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_URL}/api/citas`);
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);

      const data = await res.json();
      setCitas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Error cargando citas");
    } finally {
      setLoading(false);
    }
  };

  /**
   * CREATE
   * POST /api/citas
   * Inserta una cita en la BD con los datos del formulario.
   */
  const crearCita = async () => {
    const res = await fetch(`${API_URL}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente, servicio, fecha, hora }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }

    return res.json();
  };

  /**
   * UPDATE
   * PUT /api/citas/:id
   * Actualiza una cita existente por ID.
   */
  const actualizarCita = async (id) => {
    const res = await fetch(`${API_URL}/api/citas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente, servicio, fecha, hora }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }

    return res.json();
  };

  /**
   * DELETE
   * DELETE /api/citas/:id
   * Elimina una cita por ID.
   */
  const eliminarCita = async (id) => {
    const res = await fetch(`${API_URL}/api/citas/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }

    return res.json();
  };

  // =========================
  // EVENTOS DE UI
  // =========================

  /**
   * Maneja el submit del formulario.
   * - Si modo es "crear": llama POST
   * - Si modo es "editar": llama PUT
   * Luego recarga la lista para reflejar cambios en pantalla.
   */
  const onSubmit = async (e) => {
    e.preventDefault();
    limpiarMensajes();

    if (!validarFormulario()) return;

    try {
      setSaving(true);

      if (modo === "crear") {
        await crearCita();
        setMsgOk("Cita creada correctamente ✅");
      } else {
        await actualizarCita(editId);
        setMsgOk("Cita actualizada correctamente ✅");
      }

      // Volver al modo crear y refrescar tabla
      setModoCrear();
      await cargarCitas();
    } catch (e2) {
      setError(e2.message || "Ocurrio un error");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Carga los datos de la fila seleccionada al formulario
   * y cambia el modo a "editar".
   */
  const onClickEditar = (c) => {
    limpiarMensajes();
    setModo("editar");
    setEditId(c.id);

    // Precarga datos en el formulario
    setCliente(c.cliente || "");
    setServicio(c.servicio || "");
    setFecha(c.fecha || "");
    setHora(c.hora || "");

    // Mejora UX: subir al inicio para ver el formulario
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * Solicita confirmacion y elimina.
   * Luego recarga la lista.
   */
  const onClickEliminar = async (id) => {
    limpiarMensajes();

    const ok = window.confirm(`Seguro que deseas eliminar la cita #${id}?`);
    if (!ok) return;

    try {
      setSaving(true);
      await eliminarCita(id);
      setMsgOk("Cita eliminada correctamente ✅");
      await cargarCitas();
    } catch (e3) {
      setError(e3.message || "Error eliminando");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // EFECTO INICIAL (on mount)
  // =========================

  /**
   * Al cargar la pagina:
   * 1) Prueba conexion al backend (GET "/")
   * 2) Carga citas desde la base de datos (GET "/api/citas")
   */
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((r) => r.text())
      .then((t) => setMensaje(t))
      .catch(() => setMensaje("No se pudo leer el backend"));

    cargarCitas();
  }, []);

  // =========================
  // UI (render)
  // =========================

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>Sistema de Barberia</h1>
      <p style={{ marginTop: 0 }}>
        <b>Backend:</b> {mensaje}
      </p>

      <hr style={{ margin: "24px 0" }} />

      <h2>{tituloFormulario}</h2>

      {/* Mensaje de exito */}
      {msgOk && (
        <p style={{ color: "green" }}>
          <b>{msgOk}</b>
        </p>
      )}

      {/* Mensaje de error */}
      {error && (
        <p style={{ color: "crimson" }}>
          <b>Error:</b> {error}
        </p>
      )}

      {/* Formulario reutilizable para crear/editar */}
      <form onSubmit={onSubmit} style={{ maxWidth: 620 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <label style={{ flex: 1 }}>
            Cliente
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
              placeholder="Ej: Miguel Hernandez"
            />
          </label>

          <label style={{ flex: 1 }}>
            Servicio
            <input
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
              placeholder="Ej: Corte + Barba"
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <label style={{ flex: 1 }}>
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <label style={{ flex: 1 }}>
            Hora
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" disabled={saving} style={{ padding: "10px 14px" }}>
            {saving
              ? "Procesando..."
              : modo === "crear"
              ? "Guardar cita"
              : "Guardar cambios"}
          </button>

          {/* Boton cancelar solo se muestra en modo editar */}
          {modo === "editar" && (
            <button
              type="button"
              onClick={setModoCrear}
              disabled={saving}
              style={{ padding: "10px 14px" }}
            >
              Cancelar edicion
            </button>
          )}
        </div>
      </form>

      <hr style={{ margin: "24px 0" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Listado de citas</h2>
        <button onClick={cargarCitas} disabled={saving || loading}>
          Recargar
        </button>
      </div>

      {/* Estado de carga */}
      {loading && <p>Cargando...</p>}

      {/* Si no hay registros */}
      {!loading && citas.length === 0 && <p>No hay citas registradas aun.</p>}

      {/* Tabla de resultados */}
      {!loading && citas.length > 0 && (
        <table
          border="1"
          cellPadding="10"
          style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}
        >
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Cliente</th>
              <th>Servicio</th>
              <th style={{ width: 130 }}>Fecha</th>
              <th style={{ width: 110 }}>Hora</th>
              <th style={{ width: 210 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {citas.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.cliente}</td>
                <td>{c.servicio}</td>
                <td>{c.fecha}</td>
                <td>{c.hora}</td>
                <td>
                  <button
                    onClick={() => onClickEditar(c)}
                    disabled={saving}
                    style={{ marginRight: 8 }}
                  >
                    Editar
                  </button>
                  <button onClick={() => onClickEliminar(c.id)} disabled={saving}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}