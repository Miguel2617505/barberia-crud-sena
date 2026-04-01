import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:3000";

export default function Profile() {
    const navigate = useNavigate();
    const token = localStorage.getItem("token") || "";
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const [nombre, setNombre] = useState("");
    const [email, setEmail] = useState("");
    const [passwordActual, setPasswordActual] = useState("");
    const [nuevaPassword, setNuevaPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [msgOk, setMsgOk] = useState("");

    const cargarPerfil = async () => {
        try {
            setLoading(true);
            const r = await fetch(`${API_URL}/api/perfil`, { headers });
            if (!r.ok) throw new Error("Error cargando perfil");
            const d = await r.json();
            setNombre(d.nombre);
            setEmail(d.email);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    const guardarPerfil = async (e) => {
        e.preventDefault();
        setError(""); setMsgOk("");

        if (!nombre || !email) {
            setError("Nombre y email son obligatorios");
            return;
        }

        try {
            setSaving(true);
            const body = { nombre, email };
            if (nuevaPassword) {
                body.passwordActual = passwordActual;
                body.nuevaPassword = nuevaPassword;
            }

            const r = await fetch(`${API_URL}/api/perfil`, {
                method: "PUT", headers, body: JSON.stringify(body),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Error");

            // Update localStorage
            const updatedUser = { ...user, nombre, email: email.trim().toLowerCase() };
            localStorage.setItem("user", JSON.stringify(updatedUser));

            setMsgOk("Perfil actualizado exitosamente");
            setPasswordActual("");
            setNuevaPassword("");
            setTimeout(() => setMsgOk(""), 4000);
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    useEffect(() => { cargarPerfil(); }, []);

    const goBack = () => {
        const rol = user.rol;
        if (rol === "admin" || rol === "recepcionista") navigate("/dashboard");
        else if (rol === "barbero") navigate("/barbero");
        else if (rol === "cliente") navigate("/cliente");
        else navigate("/login");
    };

    if (loading) {
        return (
            <div style={{ minHeight: "100vh" }}>
                <nav className="navbar">
                    <span className="navbar-brand">✂️ Barbería — Perfil</span>
                </nav>
                <div className="container" style={{ paddingTop: 48 }}>
                    <div className="loading-center"><span className="spinner" /> Cargando...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh" }}>
            <nav className="navbar">
                <span className="navbar-brand">✂️ Barbería — Mi Perfil</span>
                <div className="navbar-user">
                    <button className="btn-outline btn-sm" onClick={goBack}>← Volver</button>
                </div>
            </nav>

            <div className="container" style={{ paddingTop: 48, paddingBottom: 48, maxWidth: 560 }}>
                {msgOk && <div className="msg-ok animate-in">{msgOk}</div>}
                {error && <div className="msg-error animate-in">{error}</div>}

                <div className="card-section animate-in">
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                        <div className="navbar-avatar" style={{ width: 64, height: 64, fontSize: 28, margin: "0 auto 12px" }}>
                            {(nombre || "U").charAt(0).toUpperCase()}
                        </div>
                        <h2 style={{ margin: 0 }}>{nombre}</h2>
                        <p className="text-muted" style={{ margin: "4px 0 0" }}>
                            {user.rol === "admin" ? "Administrador" :
                             user.rol === "barbero" ? "💈 Barbero" :
                             user.rol === "recepcionista" ? "🖥 Recepcionista" : "Cliente"}
                        </p>
                    </div>

                    <form onSubmit={guardarPerfil}>
                        <div className="form-group">
                            <label htmlFor="pf-nombre">Nombre</label>
                            <input id="pf-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="pf-email">Email</label>
                            <input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
                        </div>

                        <hr style={{ margin: "20px 0", borderColor: "var(--border-subtle)" }} />
                        <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
                            Deja los campos de contraseña vacíos si no deseas cambiarla.
                        </p>

                        <div className="form-group">
                            <label htmlFor="pf-pass-actual">Contraseña actual</label>
                            <input id="pf-pass-actual" type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} placeholder="••••••" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="pf-pass-nueva">Nueva contraseña</label>
                            <input id="pf-pass-nueva" type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} placeholder="Mínimo 4 caracteres" />
                        </div>

                        <button className="btn-gold" type="submit" disabled={saving} style={{ width: "100%", marginTop: 8 }}>
                            {saving ? "Guardando..." : "Guardar cambios"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
