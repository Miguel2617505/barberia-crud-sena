import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [msgOk, setMsgOk] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsgOk("");

    if (!nombre || !email || !password) {
      setError("Completa nombre, email y contraseña.");
      return;
    }

    try {
      setSaving(true);

      const resp = await fetch("http://localhost:3000/api/usuarios/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, password }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setError(data.error || "No se pudo registrar");
        return;
      }

      setMsgOk("¡Registro exitoso! Redirigiendo al inicio de sesión...");

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card card-auth">
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>✂️</div>
          <h1 className="heading-brand" style={{ fontSize: "1.8rem", marginBottom: 4 }}>
            Crear Cuenta
          </h1>
          <p className="text-secondary" style={{ margin: 0, fontSize: "0.9rem" }}>
            Regístrate para agendar tus citas
          </p>
        </div>

        {/* Messages */}
        {msgOk && <div className="msg-ok">{msgOk}</div>}
        {error && <div className="msg-error">{error}</div>}

        {/* Form */}
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="reg-nombre">Nombre completo</label>
            <input
              id="reg-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre completo"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Correo electrónico</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Contraseña</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn-gold"
            disabled={saving}
            style={{ width: "100%", padding: "14px", marginTop: 8 }}
          >
            {saving ? (
              <>
                <span className="spinner" /> Registrando...
              </>
            ) : (
              "Crear cuenta"
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
          disabled={saving}
          style={{ width: "100%" }}
        >
          Ya tengo cuenta — Iniciar sesión
        </button>
      </div>
    </div>
  );
}