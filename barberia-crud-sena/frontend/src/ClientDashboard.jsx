import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:3000";

const formatCOP = (valor) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(valor);

const getPrecio = (nombreServicio, servicios) => {
    // Handle comma-separated multi-service names
    const nombres = nombreServicio.split(", ").map(n => n.trim());
    let total = 0;
    let found = false;
    nombres.forEach(n => {
        const s = servicios.find((x) => x.nombre === n);
        if (s) { total += s.precio; found = true; }
    });
    return found ? total : null;
};

export default function ClientDashboard() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const token = localStorage.getItem("token") || "";

    // State
    const [citas, setCitas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [msgOk, setMsgOk] = useState("");

    // Services (from API)
    const [servicios, setServicios] = useState([]);

    // Barberos (from API)
    const [barberos, setBarberos] = useState([]);

    // Form
    const [showForm, setShowForm] = useState(false);
    const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
    const [fecha, setFecha] = useState("");
    const [hora, setHora] = useState("");
    const [barberoId, setBarberoId] = useState("");

    // Available slots
    const [slotsDisponibles, setSlotsDisponibles] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [slotsMsg, setSlotsMsg] = useState("");

    // Reviews
    const [misResenas, setMisResenas] = useState([]);
    const [reviewCitaId, setReviewCitaId] = useState(null);
    const [reviewPuntuacion, setReviewPuntuacion] = useState(5);
    const [reviewComentario, setReviewComentario] = useState("");
    const [savingReview, setSavingReview] = useState(false);

    const limpiar = () => {
        setError("");
        setMsgOk("");
    };

    const limpiarForm = () => {
        setServiciosSeleccionados([]);
        setFecha("");
        setHora("");
        setBarberoId("");
        setSlotsDisponibles([]);
        setSlotsMsg("");
    };

    // Logout
    const onLogout = () => {
        localStorage.removeItem("auth");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    // API: load services
    const cargarServicios = async () => {
        try {
            const res = await fetch(`${API_URL}/api/servicios`);
            const data = await res.json();
            setServicios(Array.isArray(data) ? data : []);
        } catch {
            // fallback silently
        }
    };

    // API: load barberos
    const cargarBarberos = async () => {
        try {
            const res = await fetch(`${API_URL}/api/barberos`);
            const data = await res.json();
            setBarberos(Array.isArray(data) ? data : []);
        } catch {
            // fallback silently
        }
    };

    // API: load appointments
    const cargarCitas = async () => {
        try {
            setLoading(true);
            setError("");

            const res = await fetch(`${API_URL}/api/cliente/citas`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                if (res.status === 401) {
                    onLogout();
                    return;
                }
                throw new Error(`Error HTTP ${res.status}`);
            }

            const data = await res.json();
            setCitas(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e.message || "Error cargando citas");
        } finally {
            setLoading(false);
        }
    };

    // API: create appointment + redirect to Stripe Checkout
    const crearCita = async () => {
        limpiar();

        if (serviciosSeleccionados.length === 0 || !fecha || !hora) {
            setError("Selecciona al menos un servicio, fecha y hora.");
            return;
        }

        try {
            setSaving(true);

            const res = await fetch(`${API_URL}/api/cliente/citas`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ servicios: serviciosSeleccionados, fecha, hora, barbero_id: barberoId ? Number(barberoId) : null }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || `Error HTTP ${res.status}`);
            }

            // Redirect to Stripe Checkout
            try {
                const checkoutRes = await fetch(`${API_URL}/api/create-checkout-session`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ cita_id: data.id }),
                });

                const checkoutData = await checkoutRes.json().catch(() => ({}));

                if (checkoutRes.ok && checkoutData.url) {
                    window.location.href = checkoutData.url;
                    return; // redirect happening
                }
            } catch (stripeErr) {
                console.error("Stripe redirect error:", stripeErr);
            }

            // Fallback if Stripe redirect fails
            setMsgOk("¡Cita agendada! Puedes pagar desde la tabla.");
            limpiarForm();
            setShowForm(false);
            await cargarCitas();
            setTimeout(() => setMsgOk(""), 4000);
        } catch (e) {
            setError(e.message || "Error al crear la cita");
        } finally {
            setSaving(false);
        }
    };

    // API: pay for an existing unpaid appointment
    const pagarCita = async (citaId) => {
        try {
            limpiar();
            setSaving(true);

            const res = await fetch(`${API_URL}/api/create-checkout-session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ cita_id: citaId }),
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.url) {
                window.location.href = data.url;
                return;
            }

            throw new Error(data.error || "No se pudo iniciar el pago");
        } catch (e) {
            setError(e.message || "Error al iniciar pago");
        } finally {
            setSaving(false);
        }
    };

    // API: cancel appointment
    const cancelarCita = async (id) => {
        const ok = window.confirm("¿Estás seguro de cancelar esta cita?");
        if (!ok) return;

        try {
            limpiar();
            setSaving(true);

            const res = await fetch(`${API_URL}/api/citas/${id}/cancelar`, {
                method: "PATCH",
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || "No se pudo cancelar");
            }

            setMsgOk(data.mensaje || "Cita cancelada");
            await cargarCitas();
            setTimeout(() => setMsgOk(""), 4000);
        } catch (e) {
            setError(e.message || "Error al cancelar");
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        cargarServicios();
        cargarBarberos();
        cargarCitas();
        cargarMisResenas();
    }, []);

    // Load available slots when barber + date change
    useEffect(() => {
        if (barberoId && fecha) {
            cargarSlots();
        } else {
            setSlotsDisponibles([]);
            setSlotsMsg("");
        }
    }, [barberoId, fecha]);

    const cargarSlots = async () => {
        try {
            setLoadingSlots(true);
            setSlotsMsg("");
            const r = await fetch(`${API_URL}/api/horarios-disponibles?barbero_id=${barberoId}&fecha=${fecha}`);
            const d = await r.json();
            if (d.mensaje && d.slots?.length === 0) {
                setSlotsMsg(d.mensaje);
            }
            setSlotsDisponibles(d.slots || []);
        } catch { setSlotsDisponibles([]); }
        finally { setLoadingSlots(false); }
    };

    const cargarMisResenas = async () => {
        try {
            const r = await fetch(`${API_URL}/api/resenas/mis`, { headers: { Authorization: `Bearer ${token}` } });
            if (r.ok) setMisResenas(await r.json());
        } catch { /* silent */ }
    };

    const enviarResena = async () => {
        try {
            setSavingReview(true); limpiar();
            const r = await fetch(`${API_URL}/api/resenas`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ cita_id: reviewCitaId, puntuacion: reviewPuntuacion, comentario: reviewComentario }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");
            setMsgOk("\u00a1Rese\u00f1a enviada! Gracias por tu calificaci\u00f3n.");
            setReviewCitaId(null);
            setReviewPuntuacion(5);
            setReviewComentario("");
            await cargarMisResenas();
            setTimeout(() => setMsgOk(""), 4000);
        } catch (e) { setError(e.message); }
        finally { setSavingReview(false); }
    };

    const tieneResena = (citaId) => misResenas.some((r) => r.cita_id === citaId);

    // Helpers
    const getStatusBadge = (estado) => {
        switch (estado) {
            case "cumplida":
                return <span className="badge badge-done">✓ Cumplida</span>;
            case "cancelada":
                return <span className="badge badge-cancelled">✕ Cancelada</span>;
            default:
                return <span className="badge badge-pending">● Pendiente</span>;
        }
    };

    const formatFecha = (f) => {
        try {
            const [y, m, d] = f.split("-");
            return `${d}/${m}/${y}`;
        } catch {
            return f;
        }
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* Navbar */}
            <nav className="navbar">
                <span className="navbar-brand">✂️ Barbería</span>
                <div className="navbar-user">
                    <span>Hola, <strong>{user.nombre || "Cliente"}</strong></span>
                    <div className="navbar-avatar" onClick={() => navigate("/perfil")} style={{ cursor: "pointer" }} title="Mi perfil">
                        {(user.nombre || "C").charAt(0).toUpperCase()}
                    </div>
                    <button className="btn-outline btn-sm" onClick={onLogout}>
                        Cerrar sesión
                    </button>
                </div>
            </nav>

            {/* Content */}
            <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
                {/* Header */}
                <div className="animate-in" style={{ marginBottom: 28 }}>
                    <h1 style={{ marginBottom: 4 }}>Mis Citas</h1>
                    <p className="text-secondary" style={{ margin: 0 }}>
                        Consulta y agenda tus citas en la barbería
                    </p>
                </div>

                {/* Messages */}
                {msgOk && <div className="msg-ok animate-in">{msgOk}</div>}
                {error && <div className="msg-error animate-in">{error}</div>}

                {/* New appointment toggle */}
                <div className="animate-in animate-delay-1" style={{ marginBottom: 24 }}>
                    {!showForm ? (
                        <button
                            className="btn-gold"
                            onClick={() => { limpiar(); setShowForm(true); }}
                            style={{ fontSize: "0.95rem" }}
                        >
                            + Nueva Cita
                        </button>
                    ) : (
                        <div className="card-section animate-in">
                            <h3 style={{ marginBottom: 20 }}>Agendar nueva cita</h3>

                            <div className="form-group">
                                <label>Servicios</label>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                                    {servicios.map((s) => {
                                        const checked = serviciosSeleccionados.includes(s.nombre);
                                        return (
                                            <label key={s.nombre} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 6, background: checked ? "rgba(212,175,55,0.1)" : "transparent", border: checked ? "1px solid var(--gold-400)" : "1px solid var(--border-subtle)", transition: "all 0.2s" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        setServiciosSeleccionados(prev =>
                                                            checked ? prev.filter(n => n !== s.nombre) : [...prev, s.nombre]
                                                        );
                                                    }}
                                                    style={{ accentColor: "var(--gold-400)" }}
                                                />
                                                <span>{s.nombre}</span>
                                                <span className="text-muted" style={{ marginLeft: "auto", fontSize: "0.85rem" }}>{formatCOP(s.precio)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {serviciosSeleccionados.length > 0 && (
                                    <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(212,175,55,0.08)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "0.85rem" }}>{serviciosSeleccionados.length} servicio{serviciosSeleccionados.length > 1 ? "s" : ""}</span>
                                        <strong style={{ color: "var(--gold-300)" }}>
                                            Total: {formatCOP(serviciosSeleccionados.reduce((sum, name) => {
                                                const s = servicios.find(x => x.nombre === name);
                                                return sum + (s ? s.precio : 0);
                                            }, 0))}
                                        </strong>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="cd-barbero">Barbero (opcional)</label>
                                <select
                                    id="cd-barbero"
                                    value={barberoId}
                                    onChange={(e) => setBarberoId(e.target.value)}
                                >
                                    <option value="">— Sin preferencia —</option>
                                    {barberos.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="cd-fecha">Fecha</label>
                                    <input
                                        id="cd-fecha"
                                        type="date"
                                        value={fecha}
                                        min={today}
                                        onChange={(e) => setFecha(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="cd-hora">Hora</label>
                                    {barberoId && fecha ? (
                                        <>
                                            {loadingSlots && <p className="text-muted" style={{ fontSize: "0.85rem" }}>Cargando horarios...</p>}
                                            {slotsMsg && <p className="text-muted" style={{ fontSize: "0.85rem" }}>{slotsMsg}</p>}
                                            {!loadingSlots && slotsDisponibles.length > 0 && (
                                                <select id="cd-hora" value={hora} onChange={(e) => setHora(e.target.value)}>
                                                    <option value="">— Selecciona hora —</option>
                                                    {slotsDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            )}
                                            {!loadingSlots && slotsDisponibles.length === 0 && !slotsMsg && (
                                                <input id="cd-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                                            )}
                                        </>
                                    ) : (
                                        <input id="cd-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                                    )}
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 12 }}>
                                <button
                                    className="btn-gold"
                                    onClick={crearCita}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <>
                                            <span className="spinner" /> Agendando...
                                        </>
                                    ) : (
                                        "Agendar cita"
                                    )}
                                </button>
                                <button
                                    className="btn-outline"
                                    onClick={() => { setShowForm(false); limpiarForm(); limpiar(); }}
                                    disabled={saving}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Appointments table */}
                <div className="card-section animate-in animate-delay-2">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <h3 style={{ margin: 0 }}>Historial de citas</h3>
                        <button
                            className="btn-outline btn-sm"
                            onClick={cargarCitas}
                            disabled={saving || loading}
                        >
                            ↻ Recargar
                        </button>
                    </div>

                    {loading && (
                        <div className="loading-center">
                            <span className="spinner" /> Cargando citas...
                        </div>
                    )}

                    {!loading && citas.length === 0 && (
                        <div className="empty-state">
                            <p><strong>No tienes citas aún</strong></p>
                            <p className="text-muted">Agenda tu primera cita usando el botón de arriba</p>
                        </div>
                    )}

                    {!loading && citas.length > 0 && (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Servicio</th>
                                        <th>Barbero</th>
                                        <th>Fecha</th>
                                        <th>Hora</th>
                                        <th>Costo</th>
                                        <th>Estado</th>
                                        <th>Pago</th>
                                        <th>Multa</th>
                                        <th style={{ width: 180 }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {citas.map((c) => (
                                        <tr key={c.id}>
                                            <td><strong>{c.servicio}</strong></td>
                                            <td>{c.barbero_nombre || <span className="text-muted">Sin asignar</span>}</td>
                                            <td>{formatFecha(c.fecha)}</td>
                                            <td>{c.hora}</td>
                                            <td>
                                                {getPrecio(c.servicio, servicios)
                                                    ? <strong style={{ color: "var(--gold-300)" }}>{formatCOP(getPrecio(c.servicio, servicios))}</strong>
                                                    : <span className="text-muted">—</span>}
                                            </td>
                                            <td>{getStatusBadge(c.estado)}</td>
                                            <td>
                                                {c.payment_status === "paid" ? (
                                                    <span className="badge badge-done">💳 Pagado</span>
                                                ) : (
                                                    <span className="badge badge-warning">⏳ Pendiente</span>
                                                )}
                                            </td>
                                            <td>
                                                {c.multa === 1 ? (
                                                    <span style={{ color: "var(--danger)" }}>Sí</span>
                                                ) : (
                                                    <span className="text-muted">No</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                    {c.estado === "pendiente" && c.payment_status !== "paid" && (
                                                        <button
                                                            className="btn-gold btn-sm"
                                                            onClick={() => pagarCita(c.id)}
                                                            disabled={saving}
                                                        >
                                                            💳 Pagar
                                                        </button>
                                                    )}
                                                    {c.estado === "pendiente" && (
                                                        <button
                                                            className="btn-danger btn-sm"
                                                            onClick={() => cancelarCita(c.id)}
                                                            disabled={saving}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    )}
                                                    {c.estado === "cumplida" && !tieneResena(c.id) && (
                                                        <button
                                                            className="btn-outline btn-sm"
                                                            onClick={() => { setReviewCitaId(c.id); setReviewPuntuacion(5); setReviewComentario(""); }}
                                                            disabled={saving}
                                                        >
                                                            ⭐ Calificar
                                                        </button>
                                                    )}
                                                    {c.estado === "cumplida" && tieneResena(c.id) && (
                                                        <span className="badge badge-done" style={{ fontSize: "0.75rem" }}>⭐ Calificado</span>
                                                    )}
                                                    {c.estado !== "pendiente" && c.estado !== "cumplida" && (
                                                        <span className="text-muted" style={{ fontSize: "0.82rem" }}>—</span>
                                                    )}
                                                </div>
                                                {reviewCitaId === c.id && (
                                                    <div style={{ marginTop: 8, padding: 10, background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                                                        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                                                            {[1, 2, 3, 4, 5].map((n) => (
                                                                <span key={n} style={{ cursor: "pointer", fontSize: 20, color: n <= reviewPuntuacion ? "#ffd700" : "#555" }} onClick={() => setReviewPuntuacion(n)}>★</span>
                                                            ))}
                                                        </div>
                                                        <input
                                                            placeholder="Comentario (opcional)"
                                                            value={reviewComentario}
                                                            onChange={(e) => setReviewComentario(e.target.value)}
                                                            style={{ width: "100%", padding: 6, marginBottom: 6 }}
                                                        />
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                            <button className="btn-gold btn-sm" onClick={enviarResena} disabled={savingReview}>{savingReview ? "..." : "Enviar"}</button>
                                                            <button className="btn-outline btn-sm" onClick={() => setReviewCitaId(null)}>Cancelar</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
