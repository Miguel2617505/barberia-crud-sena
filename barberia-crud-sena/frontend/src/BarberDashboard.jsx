import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:3000";

const HORAS = [];
for (let h = 8; h <= 20; h++) {
    HORAS.push(`${String(h).padStart(2, "0")}:00`);
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_SEMANA_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatDateISO(d) {
    return d.toISOString().split("T")[0];
}

function formatDateShort(dateStr) {
    const [, m, d] = dateStr.split("-");
    return `${d}/${m}`;
}

function formatFecha(f) {
    try { const [y, m, d] = f.split("-"); return `${d}/${m}/${y}`; } catch { return f; }
}

export default function BarberDashboard() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const token = localStorage.getItem("token") || "";
    const headers = { Authorization: `Bearer ${token}` };

    // ======================== STATE ========================
    const [stats, setStats] = useState({ hoy: 0, pendientes: 0, cumplidas: 0, total_semana: 0 });
    const [citas, setCitas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [msgOk, setMsgOk] = useState("");

    // Calendar
    const [semanaActual, setSemanaActual] = useState(getMondayOfWeek(new Date()));
    const [vistaCalendario, setVistaCalendario] = useState("semana"); // semana | dia
    const [diaSeleccionado, setDiaSeleccionado] = useState(formatDateISO(new Date()));

    // Notifications
    const [toasts, setToasts] = useState([]);
    const seenNotifIds = useRef(new Set());
    const pollInterval = useRef(null);

    // Saving
    const [saving, setSaving] = useState(false);

    const clearMsg = () => { setError(""); setMsgOk(""); };
    const showOk = (m) => { setMsgOk(m); setTimeout(() => setMsgOk(""), 4000); };

    // ======================== API ========================
    const cargarStats = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/api/barbero/stats`, { headers });
            if (!r.ok) return;
            const d = await r.json();
            setStats(d);
        } catch { /* silent */ }
    }, [token]);

    const cargarCitas = useCallback(async (lunes) => {
        try {
            setLoading(true);
            const semanaStr = formatDateISO(lunes || semanaActual);
            const r = await fetch(`${API_URL}/api/barbero/citas?semana=${semanaStr}`, { headers });
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                throw new Error(d.error || `Error HTTP ${r.status}`);
            }
            const d = await r.json();
            setCitas(Array.isArray(d.citas) ? d.citas : []);
        } catch (e) { setError(e.message || "Error cargando citas"); }
        finally { setLoading(false); }
    }, [token, semanaActual]);

    const pollNotificaciones = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/api/barbero/notificaciones?minutos=1`, { headers });
            if (!r.ok) return;
            const data = await r.json();
            const nuevas = (data || []).filter((n) => !seenNotifIds.current.has(n.id));
            if (nuevas.length > 0) {
                nuevas.forEach((n) => seenNotifIds.current.add(n.id));
                const newToasts = nuevas.map((n) => ({
                    id: n.id,
                    text: `Nueva cita: ${n.cliente} — ${n.servicio} (${formatDateShort(n.fecha)} ${n.hora})`,
                    ts: Date.now(),
                }));
                setToasts((prev) => [...newToasts, ...prev].slice(0, 5));
            }
        } catch { /* silent */ }
    }, [token]);

    const cumplirCita = async (id) => {
        if (!window.confirm("¿Marcar cita como cumplida?")) return;
        try {
            clearMsg(); setSaving(true);
            const r = await fetch(`${API_URL}/api/citas/${id}/cumplida`, {
                method: "PATCH",
                headers: { ...headers, "Content-Type": "application/json" },
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            showOk(d.mensaje || "Cita marcada como cumplida");
            await cargarCitas();
            await cargarStats();
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    // ======================== INIT ========================
    useEffect(() => {
        cargarStats();
        cargarCitas(semanaActual);

        // Mark existing notifications as seen on first load
        (async () => {
            try {
                const r = await fetch(`${API_URL}/api/barbero/notificaciones?minutos=5`, { headers });
                if (r.ok) {
                    const data = await r.json();
                    (data || []).forEach((n) => seenNotifIds.current.add(n.id));
                }
            } catch { /* silent */ }
        })();

        // Start polling
        pollInterval.current = setInterval(() => {
            pollNotificaciones();
        }, 30000);

        return () => clearInterval(pollInterval.current);
    }, []);

    // Reload citas when week changes
    useEffect(() => {
        cargarCitas(semanaActual);
    }, [semanaActual]);

    // Auto-dismiss toasts
    useEffect(() => {
        if (toasts.length === 0) return;
        const timer = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => Date.now() - t.ts < 8000));
        }, 8000);
        return () => clearTimeout(timer);
    }, [toasts]);

    const onLogout = () => {
        localStorage.removeItem("auth");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const dismissToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    // ======================== CALENDAR HELPERS ========================
    const diasSemana = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(semanaActual);
        d.setDate(semanaActual.getDate() + i);
        diasSemana.push(formatDateISO(d));
    }

    const hoyStr = formatDateISO(new Date());

    const getCitasForSlot = (fecha, hora) => {
        const horaBase = hora.split(":")[0];
        return citas.filter((c) => {
            if (c.fecha !== fecha) return false;
            const cHora = (c.hora || "").split(":")[0];
            return cHora === horaBase;
        });
    };

    const getCitasForDay = (fecha) => {
        return citas.filter((c) => c.fecha === fecha).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    };

    const citasHoy = getCitasForDay(hoyStr);

    const navSemana = (dir) => {
        const nueva = new Date(semanaActual);
        nueva.setDate(semanaActual.getDate() + dir * 7);
        setSemanaActual(nueva);
    };

    const irHoy = () => {
        setSemanaActual(getMondayOfWeek(new Date()));
        setDiaSeleccionado(hoyStr);
    };

    const getStatusClass = (estado) => {
        if (estado === "cumplida") return "cal-ev-done";
        if (estado === "cancelada") return "cal-ev-cancelled";
        return "cal-ev-pending";
    };

    const getStatusBadge = (e) => {
        if (e === "cumplida") return <span className="badge badge-done">✓ Cumplida</span>;
        if (e === "cancelada") return <span className="badge badge-cancelled">✕ Cancelada</span>;
        return <span className="badge badge-pending">● Pendiente</span>;
    };

    // ======================== RENDER ========================
    return (
        <div style={{ minHeight: "100vh" }}>
            {/* Navbar */}
            <nav className="navbar">
                <span className="navbar-brand">✂️ Barbería — Barbero</span>
                <div className="navbar-user">
                    <span>Hola, <strong>{user.nombre || "Barbero"}</strong></span>
                    <div className="navbar-avatar">{(user.nombre || "B").charAt(0).toUpperCase()}</div>
                    <button className="btn-outline btn-sm" onClick={onLogout}>Cerrar sesión</button>
                </div>
            </nav>

            <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
                {/* Messages */}
                {msgOk && <div className="msg-ok animate-in">{msgOk}</div>}
                {error && <div className="msg-error animate-in">{error}</div>}

                {/* ========== STATS ROW ========== */}
                <div className="stats-row animate-in">
                    <div className="stat-card">
                        <div className="stat-value">{stats.hoy}</div>
                        <div className="stat-label">Citas hoy</div>
                    </div>
                    <div className="stat-card stat-card-pending">
                        <div className="stat-value">{stats.pendientes}</div>
                        <div className="stat-label">Pendientes</div>
                    </div>
                    <div className="stat-card stat-card-done">
                        <div className="stat-value">{stats.cumplidas}</div>
                        <div className="stat-label">Cumplidas hoy</div>
                    </div>
                    <div className="stat-card stat-card-week">
                        <div className="stat-value">{stats.total_semana}</div>
                        <div className="stat-label">Esta semana</div>
                    </div>
                </div>

                {/* ========== CALENDAR ========== */}
                <div className="card-section animate-in animate-delay-1">
                    {/* Calendar header */}
                    <div className="cal-header">
                        <div className="cal-header-left">
                            <h2 style={{ margin: 0 }}>Calendario</h2>
                            <div className="cal-view-toggle">
                                <button
                                    className={vistaCalendario === "semana" ? "btn-gold btn-sm" : "btn-outline btn-sm"}
                                    onClick={() => setVistaCalendario("semana")}
                                >Semana</button>
                                <button
                                    className={vistaCalendario === "dia" ? "btn-gold btn-sm" : "btn-outline btn-sm"}
                                    onClick={() => setVistaCalendario("dia")}
                                >Día</button>
                            </div>
                        </div>
                        <div className="cal-nav">
                            <button className="btn-outline btn-sm" onClick={() => navSemana(-1)}>← Anterior</button>
                            <button className="btn-outline btn-sm" onClick={irHoy}>Hoy</button>
                            <button className="btn-outline btn-sm" onClick={() => navSemana(1)}>Siguiente →</button>
                        </div>
                    </div>

                    {/* Week info */}
                    <div className="cal-week-label">
                        {formatDateShort(diasSemana[0])} — {formatDateShort(diasSemana[6])}
                    </div>

                    {loading && <div className="loading-center"><span className="spinner" /> Cargando...</div>}

                    {/* WEEK VIEW */}
                    {!loading && vistaCalendario === "semana" && (
                        <div className="cal-grid-wrapper">
                            <div className="cal-grid" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
                                {/* Header row */}
                                <div className="cal-corner"></div>
                                {diasSemana.map((fecha, i) => (
                                    <div
                                        key={fecha}
                                        className={`cal-day-header ${fecha === hoyStr ? "cal-day-today" : ""}`}
                                        onClick={() => { setDiaSeleccionado(fecha); setVistaCalendario("dia"); }}
                                    >
                                        <span className="cal-day-name">{DIAS_SEMANA[i]}</span>
                                        <span className="cal-day-num">{fecha.split("-")[2]}</span>
                                    </div>
                                ))}

                                {/* Time rows */}
                                {HORAS.map((hora) => (
                                    <div className="cal-row" key={hora} style={{ display: "contents" }}>
                                        <div className="cal-time">{hora}</div>
                                        {diasSemana.map((fecha) => {
                                            const slotCitas = getCitasForSlot(fecha, hora);
                                            return (
                                                <div key={`${fecha}-${hora}`} className={`cal-cell ${fecha === hoyStr ? "cal-cell-today" : ""}`}>
                                                    {slotCitas.map((c) => (
                                                        <div
                                                            key={c.id}
                                                            className={`cal-event ${getStatusClass(c.estado)}`}
                                                            title={`${c.cliente} — ${c.servicio} (${c.estado})`}
                                                        >
                                                            <span className="cal-ev-client">{c.cliente}</span>
                                                            <span className="cal-ev-service">{c.servicio}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* DAY VIEW */}
                    {!loading && vistaCalendario === "dia" && (() => {
                        const idx = diasSemana.indexOf(diaSeleccionado);
                        const dayName = idx >= 0 ? DIAS_SEMANA_FULL[idx] : "";
                        const citasDia = getCitasForDay(diaSeleccionado);

                        return (
                            <div className="cal-day-view">
                                <div className="cal-day-view-header">
                                    <h3 style={{ margin: 0 }}>{dayName} {formatDateShort(diaSeleccionado)}</h3>
                                    <span className="text-muted">{citasDia.length} cita{citasDia.length !== 1 ? "s" : ""}</span>
                                </div>

                                {/* Day select pills */}
                                <div className="cal-day-pills">
                                    {diasSemana.map((fecha, i) => (
                                        <button
                                            key={fecha}
                                            className={`cal-day-pill ${fecha === diaSeleccionado ? "cal-day-pill-active" : ""} ${fecha === hoyStr ? "cal-day-pill-today" : ""}`}
                                            onClick={() => setDiaSeleccionado(fecha)}
                                        >
                                            <span>{DIAS_SEMANA[i]}</span>
                                            <span>{fecha.split("-")[2]}</span>
                                        </button>
                                    ))}
                                </div>

                                {HORAS.map((hora) => {
                                    const slotCitas = getCitasForSlot(diaSeleccionado, hora);
                                    return (
                                        <div key={hora} className="cal-day-row">
                                            <div className="cal-day-time">{hora}</div>
                                            <div className="cal-day-content">
                                                {slotCitas.length === 0 && (
                                                    <div className="cal-day-empty">—</div>
                                                )}
                                                {slotCitas.map((c) => (
                                                    <div key={c.id} className={`cal-day-event ${getStatusClass(c.estado)}`}>
                                                        <div className="cal-day-ev-main">
                                                            <strong>{c.cliente}</strong>
                                                            <span className="text-muted" style={{ fontSize: "0.82rem" }}>{c.servicio}</span>
                                                        </div>
                                                        <div className="cal-day-ev-actions">
                                                            {getStatusBadge(c.estado)}
                                                            {c.estado === "pendiente" && (
                                                                <button
                                                                    className="btn-success btn-sm"
                                                                    onClick={() => cumplirCita(c.id)}
                                                                    disabled={saving}
                                                                >✓ Cumplida</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>

                {/* ========== TODAY'S AGENDA ========== */}
                <div className="card-section animate-in animate-delay-2">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <h2 style={{ margin: 0 }}>📋 Agenda de Hoy</h2>
                        <button className="btn-outline btn-sm" onClick={() => { cargarCitas(); cargarStats(); }}>↻ Actualizar</button>
                    </div>

                    {citasHoy.length === 0 && (
                        <div className="empty-state" style={{ padding: "32px 24px" }}>
                            <p><strong>No hay citas para hoy</strong></p>
                            <p className="text-muted">Disfruta tu tiempo libre</p>
                        </div>
                    )}

                    {citasHoy.length > 0 && (
                        <div className="agenda-list">
                            {citasHoy.map((c, i) => {
                                const isNow = (() => {
                                    const now = new Date();
                                    const [h] = (c.hora || "").split(":");
                                    return now.getHours() === parseInt(h);
                                })();

                                return (
                                    <div key={c.id} className={`agenda-item ${isNow ? "agenda-item-now" : ""} ${c.estado === "cumplida" ? "agenda-item-done" : ""}`}>
                                        <div className="agenda-time">
                                            <span className="agenda-hora">{c.hora}</span>
                                            {isNow && <span className="agenda-now-dot"></span>}
                                        </div>
                                        <div className="agenda-info">
                                            <div className="agenda-main">
                                                <strong>{c.cliente}</strong>
                                                <span className="agenda-servicio">{c.servicio}</span>
                                            </div>
                                            <div className="agenda-actions">
                                                {getStatusBadge(c.estado)}
                                                {c.estado === "pendiente" && (
                                                    <button
                                                        className="btn-success btn-sm"
                                                        onClick={() => cumplirCita(c.id)}
                                                        disabled={saving}
                                                        style={{ marginLeft: 8 }}
                                                    >✓ Cumplida</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ========== TOAST NOTIFICATIONS ========== */}
            {toasts.length > 0 && (
                <div className="toast-container">
                    {toasts.map((t) => (
                        <div key={t.id} className="toast animate-toast-in">
                            <div className="toast-icon">🔔</div>
                            <div className="toast-text">{t.text}</div>
                            <button className="toast-close" onClick={() => dismissToast(t.id)}>✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
