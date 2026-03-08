import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:3000";

const formatCOP = (v) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

export default function AdminDashboard() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const token = localStorage.getItem("token") || "";
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    // Tab
    const [tab, setTab] = useState("citas");

    // Global messages
    const [error, setError] = useState("");
    const [msgOk, setMsgOk] = useState("");
    const clearMsg = () => { setError(""); setMsgOk(""); };
    const showOk = (m) => { setMsgOk(m); setTimeout(() => setMsgOk(""), 4000); };

    // ======================== CITAS ========================
    const [citas, setCitas] = useState([]);
    const [loadingCitas, setLoadingCitas] = useState(true);
    const [savingCita, setSavingCita] = useState(false);
    const [editCita, setEditCita] = useState(null); // id being edited
    const [editForm, setEditForm] = useState({ cliente: "", servicio: "", fecha: "", hora: "" });

    const cargarCitas = async () => {
        try {
            setLoadingCitas(true);
            const r = await fetch(`${API_URL}/api/citas`);
            const d = await r.json();
            setCitas(Array.isArray(d) ? d : []);
        } catch { setError("Error cargando citas"); }
        finally { setLoadingCitas(false); }
    };

    const startEditCita = (c) => {
        clearMsg();
        setEditCita(c.id);
        setEditForm({ cliente: c.cliente, servicio: c.servicio, fecha: c.fecha, hora: c.hora });
    };

    const cancelEditCita = () => { setEditCita(null); };

    const guardarCita = async () => {
        try {
            setSavingCita(true);
            clearMsg();
            const r = await fetch(`${API_URL}/api/citas/${editCita}`, { method: "PUT", headers, body: JSON.stringify(editForm) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Cita actualizada");
            setEditCita(null);
            await cargarCitas();
        } catch (e) { setError(e.message); }
        finally { setSavingCita(false); }
    };

    // Reset employee password
    const resetPassword = async (emp) => {
        const nueva = window.prompt(`Nueva contraseña para ${emp.nombre}:`);
        if (!nueva) return;
        if (nueva.length < 4) { setError("La contraseña debe tener al menos 4 caracteres"); return; }
        try {
            clearMsg();
            const r = await fetch(`${API_URL}/api/admin/reset-password/${emp.id}`, {
                method: "PATCH", headers, body: JSON.stringify({ nuevaPassword: nueva }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk(`Contraseña de ${emp.nombre} restablecida`);
        } catch (e) { setError(e.message); }
    };

    const cancelarCita = async (id) => {
        if (!window.confirm("¿Cancelar esta cita?")) return;
        try {
            clearMsg(); setSavingCita(true);
            const r = await fetch(`${API_URL}/api/citas/${id}/cancelar`, { method: "PATCH", headers });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk(d.mensaje || "Cita cancelada");
            await cargarCitas();
        } catch (e) { setError(e.message); }
        finally { setSavingCita(false); }
    };

    const cumplirCita = async (id) => {
        if (!window.confirm("¿Marcar como cumplida?")) return;
        try {
            clearMsg(); setSavingCita(true);
            const r = await fetch(`${API_URL}/api/citas/${id}/cumplida`, { method: "PATCH", headers });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk(d.mensaje || "Cita cumplida");
            await cargarCitas();
        } catch (e) { setError(e.message); }
        finally { setSavingCita(false); }
    };

    const eliminarCita = async (id) => {
        if (!window.confirm(`¿Eliminar cita #${id}?`)) return;
        try {
            clearMsg(); setSavingCita(true);
            const r = await fetch(`${API_URL}/api/citas/${id}`, { method: "DELETE" });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Cita eliminada");
            await cargarCitas();
        } catch (e) { setError(e.message); }
        finally { setSavingCita(false); }
    };

    // ======================== SERVICIOS ========================
    const [servicios, setServicios] = useState([]);
    const [loadingServ, setLoadingServ] = useState(true);
    const [editServ, setEditServ] = useState(null);
    const [editServForm, setEditServForm] = useState({ nombre: "", precio: 0 });
    const [savingServ, setSavingServ] = useState(false);

    const cargarServicios = async () => {
        try {
            setLoadingServ(true);
            const r = await fetch(`${API_URL}/api/servicios`);
            const d = await r.json();
            setServicios(Array.isArray(d) ? d : []);
        } catch { setError("Error cargando servicios"); }
        finally { setLoadingServ(false); }
    };

    const startEditServ = (s) => {
        clearMsg();
        setEditServ(s.id);
        setEditServForm({ nombre: s.nombre, precio: s.precio });
    };

    const guardarServicio = async () => {
        try {
            setSavingServ(true); clearMsg();
            const r = await fetch(`${API_URL}/api/servicios/${editServ}`, {
                method: "PUT", headers,
                body: JSON.stringify(editServForm),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Servicio actualizado");
            setEditServ(null);
            await cargarServicios();
        } catch (e) { setError(e.message); }
        finally { setSavingServ(false); }
    };

    // ======================== EMPLEADOS ========================
    const [empleados, setEmpleados] = useState([]);
    const [loadingEmp, setLoadingEmp] = useState(true);

    const cargarEmpleados = async () => {
        try {
            setLoadingEmp(true);
            const r = await fetch(`${API_URL}/api/empleados`, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                throw new Error(d.error || `Error HTTP ${r.status}`);
            }
            const d = await r.json();
            setEmpleados(Array.isArray(d) ? d : []);
        } catch (e) { setError(e.message || "Error cargando empleados"); }
        finally { setLoadingEmp(false); }
    };

    // ======================== INIT ========================
    useEffect(() => {
        cargarCitas();
        cargarServicios();
        cargarEmpleados();
    }, []);

    const onLogout = () => {
        localStorage.removeItem("auth");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    // Helpers
    const getStatusBadge = (e) => {
        if (e === "cumplida") return <span className="badge badge-done">✓ Cumplida</span>;
        if (e === "cancelada") return <span className="badge badge-cancelled">✕ Cancelada</span>;
        return <span className="badge badge-pending">● Pendiente</span>;
    };

    const formatFecha = (f) => { try { const [y, m, d] = f.split("-"); return `${d}/${m}/${y}`; } catch { return f; } };

    const tabs = [
        { key: "citas", label: "📋 Citas" },
        { key: "servicios", label: "💈 Servicios" },
        { key: "empleados", label: "👥 Empleados" },
    ];

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* Navbar */}
            <nav className="navbar">
                <span className="navbar-brand">✂️ Barbería — Admin</span>
                <div className="navbar-user">
                    <span>Hola, <strong>{user.nombre || "Admin"}</strong></span>
                    <div className="navbar-avatar">{(user.nombre || "A").charAt(0).toUpperCase()}</div>
                    <button className="btn-outline btn-sm" onClick={onLogout}>Cerrar sesión</button>
                </div>
            </nav>

            <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
                {/* Tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            className={tab === t.key ? "btn-gold btn-sm" : "btn-outline btn-sm"}
                            onClick={() => { setTab(t.key); clearMsg(); }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Messages */}
                {msgOk && <div className="msg-ok animate-in">{msgOk}</div>}
                {error && <div className="msg-error animate-in">{error}</div>}

                {/* ========== CITAS TAB ========== */}
                {tab === "citas" && (
                    <div className="card-section animate-in">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <h2 style={{ margin: 0 }}>Gestión de Citas</h2>
                            <button className="btn-outline btn-sm" onClick={cargarCitas} disabled={loadingCitas}>↻ Recargar</button>
                        </div>

                        {loadingCitas && <div className="loading-center"><span className="spinner" /> Cargando...</div>}

                        {!loadingCitas && citas.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">📅</div>
                                <p><strong>No hay citas registradas</strong></p>
                            </div>
                        )}

                        {!loadingCitas && citas.length > 0 && (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>Cliente</th><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Estado</th><th>Multa</th><th style={{ width: 300 }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {citas.map((c) => (
                                            <tr key={c.id}>
                                                {editCita === c.id ? (
                                                    <>
                                                        <td>{c.id}</td>
                                                        <td><input value={editForm.cliente} onChange={(e) => setEditForm({ ...editForm, cliente: e.target.value })} style={{ width: "100%", padding: 6 }} /></td>
                                                        <td><input value={editForm.servicio} onChange={(e) => setEditForm({ ...editForm, servicio: e.target.value })} style={{ width: "100%", padding: 6 }} /></td>
                                                        <td><input type="date" value={editForm.fecha} onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })} style={{ padding: 6 }} /></td>
                                                        <td><input type="time" value={editForm.hora} onChange={(e) => setEditForm({ ...editForm, hora: e.target.value })} style={{ padding: 6 }} /></td>
                                                        <td>{getStatusBadge(c.estado)}</td>
                                                        <td>{c.multa ? "Sí" : "No"}</td>
                                                        <td>
                                                            <button className="btn-gold btn-sm" onClick={guardarCita} disabled={savingCita} style={{ marginRight: 6 }}>
                                                                {savingCita ? "..." : "Guardar"}
                                                            </button>
                                                            <button className="btn-outline btn-sm" onClick={cancelEditCita}>Cancelar</button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td>{c.id}</td>
                                                        <td>{c.cliente}</td>
                                                        <td>{c.servicio}</td>
                                                        <td>{formatFecha(c.fecha)}</td>
                                                        <td>{c.hora}</td>
                                                        <td>{getStatusBadge(c.estado)}</td>
                                                        <td>{c.multa ? <span style={{ color: "var(--danger)" }}>Sí</span> : <span className="text-muted">No</span>}</td>
                                                        <td>
                                                            {c.estado !== "cancelada" && c.estado !== "cumplida" && (
                                                                <button className="btn-success btn-sm" onClick={() => cumplirCita(c.id)} disabled={savingCita} style={{ marginRight: 4 }}>✓ Cumplida</button>
                                                            )}
                                                            {c.estado !== "cancelada" && (
                                                                <button className="btn-warning btn-sm" onClick={() => cancelarCita(c.id)} disabled={savingCita} style={{ marginRight: 4 }}>Cancelar</button>
                                                            )}
                                                            <button className="btn-outline btn-sm" onClick={() => startEditCita(c)} disabled={savingCita} style={{ marginRight: 4 }}>✎ Editar</button>
                                                            <button className="btn-danger btn-sm" onClick={() => eliminarCita(c.id)} disabled={savingCita}>🗑</button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ========== SERVICIOS TAB ========== */}
                {tab === "servicios" && (
                    <div className="card-section animate-in">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <h2 style={{ margin: 0 }}>Gestión de Servicios</h2>
                            <button className="btn-outline btn-sm" onClick={cargarServicios} disabled={loadingServ}>↻ Recargar</button>
                        </div>

                        {loadingServ && <div className="loading-center"><span className="spinner" /> Cargando...</div>}

                        {!loadingServ && servicios.length > 0 && (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>Nombre del Servicio</th><th>Precio (COP)</th><th style={{ width: 200 }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {servicios.map((s) => (
                                            <tr key={s.id}>
                                                {editServ === s.id ? (
                                                    <>
                                                        <td>{s.id}</td>
                                                        <td><input value={editServForm.nombre} onChange={(e) => setEditServForm({ ...editServForm, nombre: e.target.value })} style={{ width: "100%", padding: 6 }} /></td>
                                                        <td><input type="number" value={editServForm.precio} onChange={(e) => setEditServForm({ ...editServForm, precio: Number(e.target.value) })} style={{ width: "100%", padding: 6 }} /></td>
                                                        <td>
                                                            <button className="btn-gold btn-sm" onClick={guardarServicio} disabled={savingServ} style={{ marginRight: 6 }}>
                                                                {savingServ ? "..." : "Guardar"}
                                                            </button>
                                                            <button className="btn-outline btn-sm" onClick={() => setEditServ(null)}>Cancelar</button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td>{s.id}</td>
                                                        <td><strong>{s.nombre}</strong></td>
                                                        <td><strong style={{ color: "var(--gold-300)" }}>{formatCOP(s.precio)}</strong></td>
                                                        <td>
                                                            <button className="btn-outline btn-sm" onClick={() => startEditServ(s)}>✎ Editar precio</button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ========== EMPLEADOS TAB ========== */}
                {tab === "empleados" && (
                    <div className="card-section animate-in">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <h2 style={{ margin: 0 }}>Empleados</h2>
                            <button className="btn-outline btn-sm" onClick={cargarEmpleados} disabled={loadingEmp}>↻ Recargar</button>
                        </div>

                        {loadingEmp && <div className="loading-center"><span className="spinner" /> Cargando...</div>}

                        {!loadingEmp && empleados.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">👥</div>
                                <p><strong>No hay empleados registrados</strong></p>
                                <p className="text-muted">Los barberos y recepcionistas aparecerán aquí</p>
                            </div>
                        )}

                        {!loadingEmp && empleados.length > 0 && (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Fecha de registro</th><th style={{ width: 120 }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {empleados.map((e) => (
                                            <tr key={e.id}>
                                                <td>{e.id}</td>
                                                <td><strong>{e.nombre}</strong></td>
                                                <td>{e.email}</td>
                                                <td>
                                                    <span className="badge badge-pending" style={e.rol === "barbero" ? {} : { background: "rgba(100, 181, 246, 0.12)", color: "#64b5f6", borderColor: "rgba(100, 181, 246, 0.2)" }}>
                                                        {e.rol === "barbero" ? "💈 Barbero" : "🖥 Recepcionista"}
                                                    </span>
                                                </td>
                                                <td className="text-muted">{formatFecha(e.created_at?.split(" ")[0] || "")}</td>
                                                <td>
                                                    <button className="btn-outline btn-sm" onClick={() => resetPassword(e)}>🔑 Reset</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
