import { useNavigate } from "react-router-dom";

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            textAlign: "center",
            padding: 24,
        }}>
            <div className="animate-in" style={{
                fontSize: "8rem",
                fontWeight: 900,
                lineHeight: 1,
                background: "linear-gradient(135deg, var(--gold-300), var(--gold-500))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: 8,
            }}>
                404
            </div>
            <h2 className="animate-in" style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>
                Página no encontrada
            </h2>
            <p className="text-muted animate-in" style={{ marginBottom: 32, maxWidth: 400 }}>
                Lo sentimos, la página que buscas no existe o fue movida.
            </p>
            <div className="animate-in" style={{ display: "flex", gap: 12 }}>
                <button className="btn-gold" onClick={() => navigate("/")} style={{ padding: "12px 28px" }}>
                    🏠 Ir al inicio
                </button>
                <button className="btn-outline" onClick={() => navigate(-1)} style={{ padding: "12px 28px" }}>
                    ← Volver
                </button>
            </div>
        </div>
    );
}
