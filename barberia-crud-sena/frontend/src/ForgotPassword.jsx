import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:3000";

export default function ForgotPassword() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [nombre, setNombre] = useState("");
    const [nuevaPassword, setNuevaPassword] = useState("");
    const [confirmar, setConfirmar] = useState("");

    const [error, setError] = useState("");
    const [msgOk, setMsgOk] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMsgOk("");

        if (!email || !nombre || !nuevaPassword || !confirmar) {
            setError("Todos los campos son obligatorios.");
            return;
        }

        if (nuevaPassword !== confirmar) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        if (nuevaPassword.length < 4) {
            setError("La contraseña debe tener al menos 4 caracteres.");
            return;
        }

        try {
            setLoading(true);

            const resp = await fetch(`${API_URL}/api/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    nombre: nombre.trim(),
                    nuevaPassword,
                }),
            });

            const data = await resp.json().catch(() => ({}));

            if (!resp.ok) {
                setError(data.error || "Error al restablecer la contraseña");
                return;
            }

            setMsgOk("¡Contraseña actualizada exitosamente! Redirigiendo al login...");
            setTimeout(() => navigate("/login"), 2500);
        } catch {
            setError("No se pudo conectar con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-center">
            <div className="card card-auth">
                {/* Brand */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔑</div>
                    <h1 className="heading-brand" style={{ fontSize: "1.6rem", marginBottom: 4 }}>
                        Restablecer contraseña
                    </h1>
                    <p className="text-secondary" style={{ margin: 0, fontSize: "0.85rem" }}>
                        Ingresa tu correo y nombre completo para verificar tu identidad
                    </p>
                </div>

                {error && <div className="msg-error">{error}</div>}
                {msgOk && <div className="msg-ok">{msgOk}</div>}

                <form onSubmit={onSubmit}>
                    <div className="form-group">
                        <label htmlFor="fp-email">Correo electrónico</label>
                        <input
                            id="fp-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="fp-nombre">Nombre completo (como fue registrado)</label>
                        <input
                            id="fp-nombre"
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Tu nombre completo"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="fp-password">Nueva contraseña</label>
                        <input
                            id="fp-password"
                            type="password"
                            value={nuevaPassword}
                            onChange={(e) => setNuevaPassword(e.target.value)}
                            placeholder="Mínimo 4 caracteres"
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="fp-confirm">Confirmar contraseña</label>
                        <input
                            id="fp-confirm"
                            type="password"
                            value={confirmar}
                            onChange={(e) => setConfirmar(e.target.value)}
                            placeholder="Repite la contraseña"
                            autoComplete="new-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-gold"
                        disabled={loading}
                        style={{ width: "100%", padding: "14px", marginTop: 8 }}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" /> Restableciendo...
                            </>
                        ) : (
                            "Restablecer contraseña"
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="divider">o</div>

                {/* Back to login */}
                <button
                    type="button"
                    className="btn-outline"
                    onClick={() => navigate("/login")}
                    style={{ width: "100%" }}
                >
                    Volver al inicio de sesión
                </button>
            </div>
        </div>
    );
}
