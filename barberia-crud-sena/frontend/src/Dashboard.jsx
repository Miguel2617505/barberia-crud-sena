import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:3000";

export default function Dashboard() {
    // Estado general
  const [mensaje, setMensaje] = useState("");
  const navigate = useNavigate();
  const [citas, setCitas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [msgOk, setMsgOk] = useState("");

  // Formulario
  const [modo, setModo] = useState("crear");
  const [editId, setEditId] = useState(null);

  const [cliente, setCliente] = useState("");
  const [servicio, setServicio] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");

  const tituloFormulario = useMemo(() => {
    return modo === "editar" ? `Editar cita #${editId}` : "Crear cita";
  }, [modo, editId]);

  const limpiarMensajes = () => {
    setError("");
    setMsgOk("");
  };

  const limpiarFormulario = () => {
    setCliente("");
    setServicio("");
    setFecha("");
    setHora("");
  };

  const setModoCrear = () => {
    setModo("crear");
    setEditId(null);
    limpiarFormulario();
  };

  const validarFormulario = () => {
    if (!cliente || !servicio || !fecha || !hora) {
      setError("Completa todos los campos: cliente, servicio, fecha y hora.");
      return false;
    }
    return true;
  };
  // Funcion deslogear
  const onLogout = () => {
  localStorage.removeItem("auth");
  navigate("/login");
};

  // =========================
  // API
  // =========================

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

  const crearCita = async () => {
    const res = await fetch(`${API_URL}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente, servicio, fecha, hora }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }

    return data;
  };

  const actualizarCita = async (id) => {
    const res = await fetch(`${API_URL}/api/citas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente, servicio, fecha, hora }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }

    return data;
  };

  const eliminarCita = async (id) => {
    const res = await fetch(`${API_URL}/api/citas/${id}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }

    return data;
  };

  // CU7: cancelar
  async function cancelarCita(id) {
    const res = await fetch(`${API_URL}/api/citas/${id}/cancelar`, {
      method: "PATCH",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "No se pudo cancelar la cita");
    }

    return data;
  }

  async function onCancelar(id) {
    const ok = window.confirm("Estas seguro de cancelar esta cita?");
    if (!ok) return;

    try {
      limpiarMensajes();
      setSaving(true);

      const result = await cancelarCita(id);
      setMsgOk(result.mensaje);

      await cargarCitas();
    } catch (e) {
      setError(e.message || "Error al cancelar");
    } finally {
      setSaving(false);
    }
  }

  // CU6: marcar cumplida
  async function marcarCumplida(id) {
    const res = await fetch(`${API_URL}/api/citas/${id}/cumplida`, {
      method: "PATCH",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "No se pudo marcar como cumplida");
    }

    return data;
  }

  async function onCumplida(id) {
    const ok = window.confirm("Estas seguro de marcar esta cita como cumplida?");
    if (!ok) return;

    try {
      limpiarMensajes();
      setSaving(true);

      const result = await marcarCumplida(id);
      setMsgOk(result.mensaje);

      await cargarCitas();
    } catch (e) {
      setError(e.message || "Error al marcar cumplida");
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // UI eventos
  // =========================

  const onSubmit = async (e) => {
    e.preventDefault();
    limpiarMensajes();

    if (!validarFormulario()) return;

    try {
      setSaving(true);

      if (modo === "crear") {
        await crearCita();
        setMsgOk("Cita creada correctamente");
      } else {
        await actualizarCita(editId);
        setMsgOk("Cita actualizada correctamente");
      }

      setModoCrear();
      await cargarCitas();
    } catch (e2) {
      setError(e2.message || "Ocurrio un error");
    } finally {
      setSaving(false);
    }
  };

  const onClickEditar = (c) => {
    limpiarMensajes();
    setModo("editar");
    setEditId(c.id);

    setCliente(c.cliente || "");
    setServicio(c.servicio || "");
    setFecha(c.fecha || "");
    setHora(c.hora || "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onClickEliminar = async (id) => {
    limpiarMensajes();

    const ok = window.confirm(`Seguro que deseas eliminar la cita #${id}?`);
    if (!ok) return;

    try {
      setSaving(true);
      await eliminarCita(id);
      setMsgOk("Cita eliminada correctamente");
      await cargarCitas();
    } catch (e3) {
      setError(e3.message || "Error eliminando");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Inicio
  // =========================

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((r) => r.text())
      .then((t) => setMensaje(t))
      .catch(() => setMensaje("No se pudo leer el backend"));

    cargarCitas();
  }, []);

  // =========================
  // Render
  // =========================

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>Sistema de Barberia</h1>
      <button onClick={onLogout} style={{ marginBottom: 16 }}>
      Cerrar sesion
      </button>
      <p style={{ marginTop: 0 }}>
        <b>Backend:</b> {mensaje}
      </p>

      <hr style={{ margin: "24px 0" }} />

      <h2>{tituloFormulario}</h2>

      {msgOk && (
        <p style={{ color: "green" }}>
          <b>{msgOk}</b>
        </p>
      )}

      {error && (
        <p style={{ color: "crimson" }}>
          <b>Error:</b> {error}
        </p>
      )}

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
            {saving ? "Procesando..." : modo === "crear" ? "Guardar cita" : "Guardar cambios"}
          </button>

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

      {loading && <p>Cargando...</p>}
      {!loading && citas.length === 0 && <p>No hay citas registradas aun.</p>}

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
              <th style={{ width: 120 }}>Estado</th>
              <th style={{ width: 90 }}>Multa</th>
              <th style={{ width: 360 }}>Acciones</th>
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
                <td>{c.estado}</td>
                <td>{c.multa === 1 ? "Si" : "No"}</td>
                <td>
                  {c.estado !== "cancelada" && c.estado !== "cumplida" && (
                    <button
                      onClick={() => onCumplida(c.id)}
                      disabled={saving}
                      style={{ marginRight: 8 }}
                    >
                      Marcar cumplida
                    </button>
                  )}

                  {c.estado !== "cancelada" && (
                    <button
                      onClick={() => onCancelar(c.id)}
                      disabled={saving}
                      style={{ marginRight: 8 }}
                    >
                      Cancelar
                    </button>
                  )}

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