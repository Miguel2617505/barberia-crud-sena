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

    // ======================== ADMIN STATS ========================
    const [stats, setStats] = useState(null);
    const cargarStats = async () => {
        try {
            const r = await fetch(`${API_URL}/api/admin/stats`, { headers });
            if (r.ok) setStats(await r.json());
        } catch { /* silent */ }
    };

    // ======================== FILTERS ========================
    const [filtroEstado, setFiltroEstado] = useState("");
    const [filtroDesde, setFiltroDesde] = useState("");
    const [filtroHasta, setFiltroHasta] = useState("");
    const [filtroBarbero, setFiltroBarbero] = useState("");

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
    const [showNewServ, setShowNewServ] = useState(false);
    const [newServForm, setNewServForm] = useState({ nombre: "", precio: 0 });

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

    const crearServicio = async () => {
        try {
            setSavingServ(true); clearMsg();
            const r = await fetch(`${API_URL}/api/servicios`, {
                method: "POST", headers,
                body: JSON.stringify(newServForm),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Servicio creado");
            setShowNewServ(false);
            setNewServForm({ nombre: "", precio: 0 });
            await cargarServicios();
        } catch (e) { setError(e.message); }
        finally { setSavingServ(false); }
    };

    const eliminarServicio = async (id) => {
        if (!window.confirm("¿Eliminar este servicio?")) return;
        try {
            clearMsg(); setSavingServ(true);
            const r = await fetch(`${API_URL}/api/servicios/${id}`, { method: "DELETE", headers });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Servicio eliminado");
            await cargarServicios();
        } catch (e) { setError(e.message); }
        finally { setSavingServ(false); }
    };

    // ======================== EMPLEADOS ========================
    const [empleados, setEmpleados] = useState([]);
    const [loadingEmp, setLoadingEmp] = useState(true);
    const [savingEmp, setSavingEmp] = useState(false);
    const [showNewEmp, setShowNewEmp] = useState(false);
    const [newEmpForm, setNewEmpForm] = useState({ nombre: "", email: "", password: "", rol: "barbero" });

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

    const crearEmpleado = async () => {
        try {
            setSavingEmp(true); clearMsg();
            const r = await fetch(`${API_URL}/api/empleados`, {
                method: "POST", headers,
                body: JSON.stringify(newEmpForm),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Empleado creado");
            setShowNewEmp(false);
            setNewEmpForm({ nombre: "", email: "", password: "", rol: "barbero" });
            await cargarEmpleados();
        } catch (e) { setError(e.message); }
        finally { setSavingEmp(false); }
    };

    const eliminarEmpleado = async (id) => {
        if (!window.confirm("¿Eliminar este empleado?")) return;
        try {
            clearMsg(); setSavingEmp(true);
            const r = await fetch(`${API_URL}/api/empleados/${id}`, { method: "DELETE", headers });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Empleado eliminado");
            await cargarEmpleados();
        } catch (e) { setError(e.message); }
        finally { setSavingEmp(false); }
    };

    // ======================== HORARIOS ========================
    const DIAS_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const [horarios, setHorarios] = useState([]);
    const [loadingHor, setLoadingHor] = useState(true);
    const [savingHor, setSavingHor] = useState(false);
    const [showNewHor, setShowNewHor] = useState(false);
    const [newHorForm, setNewHorForm] = useState({ barbero_id: "", dia_semana: 1, hora_inicio: "08:00", hora_fin: "18:00" });
    const [barberos, setBarberos] = useState([]);

    const cargarHorarios = async () => {
        try {
            setLoadingHor(true);
            const r = await fetch(`${API_URL}/api/horarios`, { headers });
            const d = await r.json();
            setHorarios(Array.isArray(d) ? d : []);
        } catch { setError("Error cargando horarios"); }
        finally { setLoadingHor(false); }
    };

    const cargarBarberos = async () => {
        try {
            const r = await fetch(`${API_URL}/api/barberos`);
            const d = await r.json();
            setBarberos(Array.isArray(d) ? d : []);
        } catch { /* silent */ }
    };

    const crearHorario = async () => {
        try {
            setSavingHor(true); clearMsg();
            const r = await fetch(`${API_URL}/api/horarios`, {
                method: "POST", headers,
                body: JSON.stringify({ ...newHorForm, barbero_id: Number(newHorForm.barbero_id), dia_semana: Number(newHorForm.dia_semana) }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Horario creado");
            setShowNewHor(false);
            await cargarHorarios();
        } catch (e) { setError(e.message); }
        finally { setSavingHor(false); }
    };

    const eliminarHorario = async (id) => {
        if (!window.confirm("¿Eliminar este horario?")) return;
        try {
            clearMsg(); setSavingHor(true);
            const r = await fetch(`${API_URL}/api/horarios/${id}`, { method: "DELETE", headers });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk("Horario eliminado");
            await cargarHorarios();
        } catch (e) { setError(e.message); }
        finally { setSavingHor(false); }
    };

    // ======================== INIT ========================
    useEffect(() => {
        cargarCitas();
        cargarServicios();
        cargarEmpleados();
        cargarStats();
        cargarHorarios();
        cargarBarberos();
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

    // Filtered citas
    const citasFiltradas = citas.filter((c) => {
        if (filtroEstado && c.estado !== filtroEstado) return false;
        if (filtroDesde && c.fecha < filtroDesde) return false;
        if (filtroHasta && c.fecha > filtroHasta) return false;
        if (filtroBarbero && String(c.barbero_id) !== filtroBarbero) return false;
        return true;
    });

    const tabs = [
        { key: "citas", label: "📋 Citas" },
        { key: "servicios", label: "💈 Servicios" },
        { key: "empleados", label: "👥 Empleados" },
        { key: "horarios", label: "📅 Horarios" },
    ];

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* Navbar */}
            <nav className="navbar">
                <span className="navbar-brand">✂️ Barbería — Admin</span>
                <div className="navbar-user">
                    <span>Hola, <strong>{user.nombre || "Admin"}</strong></span>
                    <div className="navbar-avatar" onClick={() => navigate("/perfil")} style={{ cursor: "pointer" }} title="Mi perfil">{(user.nombre || "A").charAt(0).toUpperCase()}</div>
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

                {/* Stats Cards */}
                {stats && (
                    <div className="stats-row animate-in" style={{ marginBottom: 24 }}>
                        <div className="stat-card">
                            <div className="stat-value">{stats.total_clientes}</div>
                            <div className="stat-label">Clientes</div>
                        </div>
                        <div className="stat-card stat-card-pending">
                            <div className="stat-value">{stats.total_citas}</div>
                            <div className="stat-label">Total citas</div>
                        </div>
                        <div className="stat-card stat-card-done">
                            <div className="stat-value">{stats.cumplidas_semana}</div>
                            <div className="stat-label">Cumplidas (semana)</div>
                        </div>
                        <div className="stat-card stat-card-week">
                            <div className="stat-value">{formatCOP(stats.ingresos_semana)}</div>
                            <div className="stat-label">Ingresos semana</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ fontSize: "0.95rem" }}>{stats.servicio_popular}</div>
                            <div className="stat-label">⭐ Más popular</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ fontSize: "0.95rem" }}>{stats.top_barbero}</div>
                            <div className="stat-label">🏆 Top barbero</div>
                        </div>
                    </div>
                )}

                {/* ========== CITAS TAB ========== */}
                {tab === "citas" && (
                    <div className="card-section animate-in">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <h2 style={{ margin: 0 }}>Gestión de Citas</h2>
                            <button className="btn-outline btn-sm" onClick={cargarCitas} disabled={loadingCitas}>↻ Recargar</button>
                        </div>

                        {/* Filters */}
                        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                            <label style={{ fontSize: "0.82rem" }}>
                                Estado
                                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ display: "block", padding: 6, marginTop: 4 }}>
                                    <option value="">Todas</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="cumplida">Cumplida</option>
                                    <option value="cancelada">Cancelada</option>
                                </select>
                            </label>
                            <label style={{ fontSize: "0.82rem" }}>
                                Desde
                                <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} style={{ display: "block", padding: 6, marginTop: 4 }} />
                            </label>
                            <label style={{ fontSize: "0.82rem" }}>
                                Hasta
                                <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} style={{ display: "block", padding: 6, marginTop: 4 }} />
                            </label>
                            <label style={{ fontSize: "0.82rem" }}>
                                Barbero
                                <select value={filtroBarbero} onChange={(e) => setFiltroBarbero(e.target.value)} style={{ display: "block", padding: 6, marginTop: 4 }}>
                                    <option value="">Todos</option>
                                    {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                </select>
                            </label>
                            {(filtroEstado || filtroDesde || filtroHasta || filtroBarbero) && (
                                <button className="btn-outline btn-sm" onClick={() => { setFiltroEstado(""); setFiltroDesde(""); setFiltroHasta(""); setFiltroBarbero(""); }} style={{ height: 32 }}>✕ Limpiar</button>
                            )}
                        </div>

                        {loadingCitas && <div className="loading-center"><span className="spinner" /> Cargando...</div>}

                        {!loadingCitas && citasFiltradas.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">📅</div>
                                <p><strong>No hay citas {filtroEstado || filtroDesde || filtroHasta || filtroBarbero ? "que coincidan con los filtros" : "registradas"}</strong></p>
                            </div>
                        )}

                        {!loadingCitas && citasFiltradas.length > 0 && (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>Cliente</th><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Estado</th><th>Multa</th><th style={{ width: 300 }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {citasFiltradas.map((c) => (
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
                            <div style={{ display: "flex", gap: 8 }}>
                                <button className="btn-gold btn-sm" onClick={() => { clearMsg(); setShowNewServ(!showNewServ); }}>{showNewServ ? "✕ Cancelar" : "➕ Nuevo Servicio"}</button>
                                <button className="btn-outline btn-sm" onClick={cargarServicios} disabled={loadingServ}>↻ Recargar</button>
                            </div>
                        </div>

                        {showNewServ && (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                                <h3 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Nuevo Servicio</h3>
                                <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                                    <label style={{ flex: 2 }}>
                                        Nombre
                                        <input value={newServForm.nombre} onChange={(e) => setNewServForm({ ...newServForm, nombre: e.target.value })} placeholder="Ej: Tinte de barba" style={{ width: "100%", padding: 8, marginTop: 4 }} />
                                    </label>
                                    <label style={{ flex: 1 }}>
                                        Precio (COP)
                                        <input type="number" value={newServForm.precio} onChange={(e) => setNewServForm({ ...newServForm, precio: Number(e.target.value) })} placeholder="25000" style={{ width: "100%", padding: 8, marginTop: 4 }} />
                                    </label>
                                    <button className="btn-gold btn-sm" onClick={crearServicio} disabled={savingServ} style={{ height: 38 }}>
                                        {savingServ ? "..." : "Guardar"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {loadingServ && <div className="loading-center"><span className="spinner" /> Cargando...</div>}

                        {!loadingServ && servicios.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">💈</div>
                                <p><strong>No hay servicios registrados</strong></p>
                            </div>
                        )}

                        {!loadingServ && servicios.length > 0 && (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>Nombre del Servicio</th><th>Precio (COP)</th><th style={{ width: 240 }}>Acciones</th>
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
                                                            <button className="btn-outline btn-sm" onClick={() => startEditServ(s)} style={{ marginRight: 4 }}>✎ Editar</button>
                                                            <button className="btn-danger btn-sm" onClick={() => eliminarServicio(s.id)} disabled={savingServ}>🗑</button>
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
                            <div style={{ display: "flex", gap: 8 }}>
                                <button className="btn-gold btn-sm" onClick={() => { clearMsg(); setShowNewEmp(!showNewEmp); }}>{showNewEmp ? "✕ Cancelar" : "➕ Nuevo Empleado"}</button>
                                <button className="btn-outline btn-sm" onClick={cargarEmpleados} disabled={loadingEmp}>↻ Recargar</button>
                            </div>
                        </div>

                        {showNewEmp && (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                                <h3 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Nuevo Empleado</h3>
                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                                    <label style={{ flex: 1, minWidth: 160 }}>
                                        Nombre
                                        <input value={newEmpForm.nombre} onChange={(e) => setNewEmpForm({ ...newEmpForm, nombre: e.target.value })} placeholder="Nombre completo" style={{ width: "100%", padding: 8, marginTop: 4 }} />
                                    </label>
                                    <label style={{ flex: 1, minWidth: 160 }}>
                                        Email
                                        <input type="email" value={newEmpForm.email} onChange={(e) => setNewEmpForm({ ...newEmpForm, email: e.target.value })} placeholder="correo@ejemplo.com" style={{ width: "100%", padding: 8, marginTop: 4 }} />
                                    </label>
                                    <label style={{ flex: 1, minWidth: 140 }}>
                                        Contraseña
                                        <input type="password" value={newEmpForm.password} onChange={(e) => setNewEmpForm({ ...newEmpForm, password: e.target.value })} placeholder="Mínimo 4 caracteres" style={{ width: "100%", padding: 8, marginTop: 4 }} />
                                    </label>
                                    <label style={{ flex: 0, minWidth: 140 }}>
                                        Rol
                                        <select value={newEmpForm.rol} onChange={(e) => setNewEmpForm({ ...newEmpForm, rol: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 4 }}>
                                            <option value="barbero">💈 Barbero</option>
                                            <option value="recepcionista">🖥 Recepcionista</option>
                                        </select>
                                    </label>
                                    <button className="btn-gold btn-sm" onClick={crearEmpleado} disabled={savingEmp} style={{ height: 38 }}>
                                        {savingEmp ? "..." : "Guardar"}
                                    </button>
                                </div>
                            </div>
                        )}

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
                                            <th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Fecha de registro</th><th style={{ width: 180 }}>Acciones</th>
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
                                                    <button className="btn-outline btn-sm" onClick={() => resetPassword(e)} style={{ marginRight: 4 }}>🔑 Reset</button>
                                                    <button className="btn-danger btn-sm" onClick={() => eliminarEmpleado(e.id)} disabled={savingEmp}>🗑</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ========== HORARIOS TAB ========== */}
                {tab === "horarios" && (
                    <div className="card-section animate-in">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <h2 style={{ margin: 0 }}>Horarios de Barberos</h2>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button className="btn-gold btn-sm" onClick={() => { clearMsg(); setShowNewHor(!showNewHor); }}>{showNewHor ? "✕ Cancelar" : "➕ Nuevo Horario"}</button>
                                <button className="btn-outline btn-sm" onClick={cargarHorarios} disabled={loadingHor}>↻ Recargar</button>
                            </div>
                        </div>

                        {showNewHor && (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                                <h3 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Nuevo Horario</h3>
                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                                    <label style={{ flex: 1, minWidth: 140 }}>
                                        Barbero
                                        <select value={newHorForm.barbero_id} onChange={(e) => setNewHorForm({ ...newHorForm, barbero_id: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 4 }}>
                                            <option value="">— Seleccionar —</option>
                                            {barberos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                        </select>
                                    </label>
                                    <label style={{ flex: 1, minWidth: 120 }}>
                                        Día
                                        <select value={newHorForm.dia_semana} onChange={(e) => setNewHorForm({ ...newHorForm, dia_semana: Number(e.target.value) })} style={{ width: "100%", padding: 8, marginTop: 4 }}>
                                            {DIAS_NOMBRE.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </label>
                                    <label style={{ flex: 0, minWidth: 100 }}>
                                        Inicio
                                        <input type="time" value={newHorForm.hora_inicio} onChange={(e) => setNewHorForm({ ...newHorForm, hora_inicio: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 4 }} />
                                    </label>
                                    <label style={{ flex: 0, minWidth: 100 }}>
                                        Fin
                                        <input type="time" value={newHorForm.hora_fin} onChange={(e) => setNewHorForm({ ...newHorForm, hora_fin: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 4 }} />
                                    </label>
                                    <button className="btn-gold btn-sm" onClick={crearHorario} disabled={savingHor} style={{ height: 38 }}>
                                        {savingHor ? "..." : "Guardar"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {loadingHor && <div className="loading-center"><span className="spinner" /> Cargando...</div>}

                        {!loadingHor && horarios.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">📅</div>
                                <p><strong>No hay horarios registrados</strong></p>
                                <p className="text-muted">Agrega horarios para los barberos</p>
                            </div>
                        )}

                        {!loadingHor && horarios.length > 0 && (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>Barbero</th><th>Día</th><th>Hora Inicio</th><th>Hora Fin</th><th style={{ width: 100 }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {horarios.map((h) => (
                                            <tr key={h.id}>
                                                <td>{h.id}</td>
                                                <td><strong>{h.barbero_nombre}</strong></td>
                                                <td>{DIAS_NOMBRE[h.dia_semana]}</td>
                                                <td>{h.hora_inicio}</td>
                                                <td>{h.hora_fin}</td>
                                                <td>
                                                    <button className="btn-danger btn-sm" onClick={() => eliminarHorario(h.id)} disabled={savingHor}>🗑</button>
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
