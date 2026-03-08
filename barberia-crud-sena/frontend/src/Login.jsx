import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email y contraseña son obligatorios.");
      return;
    }

    try {
      setLoading(true);
      const emailLimpio = email.trim().toLowerCase();
      const passwordLimpia = password.trim();

      const resp = await fetch("http://localhost:3000/api/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLimpio, password: passwordLimpia }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setError(data.error || "No se pudo iniciar sesión");
        return;
      }

      // Store auth data
      localStorage.setItem("auth", "true");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Route by role
      if (data.user.rol === "cliente") {
        navigate("/cliente");
      } else if (data.user.rol === "barbero") {
        navigate("/barbero");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor. Verifica que esté corriendo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card card-auth">
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 className="heading-brand" style={{ fontSize: "1.8rem", marginBottom: 4 }}>
            Barbería
          </h1>
          <p className="text-secondary" style={{ margin: 0, fontSize: "0.9rem" }}>
            Inicia sesión en tu cuenta
          </p>
        </div>

        {/* Error message */}
        {error && <div className="msg-error">{error}</div>}

        {/* Form */}
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
            />
          </div>

          {/* Forgot password link */}
          <div style={{ textAlign: "right", marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              style={{
                background: "none",
                border: "none",
                color: "var(--gold-400)",
                cursor: "pointer",
                fontSize: "0.82rem",
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="submit"
            className="btn-gold"
            disabled={loading}
            style={{ width: "100%", padding: "14px", marginTop: 8 }}
          >
            {loading ? (
              <>
                <span className="spinner" /> Ingresando...
              </>
            ) : (
              "Ingresar"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="divider">o</div>

        {/* Register link */}
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/register")}
          style={{ width: "100%" }}
        >
          Crear una cuenta nueva
        </button>
      </div>
    </div>
  );
}