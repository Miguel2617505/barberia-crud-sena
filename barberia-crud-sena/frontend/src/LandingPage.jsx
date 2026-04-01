import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:3000";
const formatCOP = (v) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

export default function LandingPage() {
    const navigate = useNavigate();
    const [servicios, setServicios] = useState([]);
    const [barberos, setBarberos] = useState([]);
    const [topReviews, setTopReviews] = useState([]);

    useEffect(() => {
        fetch(`${API_URL}/api/servicios`).then(r => r.json()).then(d => setServicios(Array.isArray(d) ? d : [])).catch(() => {});
        fetch(`${API_URL}/api/barberos`).then(r => r.json()).then(d => setBarberos(Array.isArray(d) ? d : [])).catch(() => {});
        // Load top reviews for each barber
        fetch(`${API_URL}/api/barberos`).then(r => r.json()).then(async (barbers) => {
            const reviews = [];
            for (const b of (Array.isArray(barbers) ? barbers : []).slice(0, 5)) {
                try {
                    const r = await fetch(`${API_URL}/api/resenas/barbero/${b.id}`);
                    const d = await r.json();
                    if (d.resenas) reviews.push(...d.resenas.slice(0, 2).map(rev => ({ ...rev, barbero: b.nombre })));
                } catch { /* silent */ }
            }
            setTopReviews(reviews.slice(0, 6));
        }).catch(() => {});
    }, []);

    const isLoggedIn = !!localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const goToDashboard = () => {
        if (!isLoggedIn) return navigate("/login");
        if (user.rol === "admin") return navigate("/dashboard");
        if (user.rol === "barbero") return navigate("/barbero");
        return navigate("/cliente");
    };

    return (
        <div style={{ minHeight: "100vh" }}>
            {/* Navbar */}
            <nav className="navbar" style={{ position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(16px)" }}>
                <span className="navbar-brand" style={{ fontSize: "1.3rem" }}>✂️ Barbería Premium</span>
                <div style={{ display: "flex", gap: 10 }}>
                    {isLoggedIn ? (
                        <button className="btn-gold btn-sm" onClick={goToDashboard}>Mi Panel</button>
                    ) : (
                        <>
                            <button className="btn-outline btn-sm" onClick={() => navigate("/login")}>Iniciar Sesión</button>
                            <button className="btn-gold btn-sm" onClick={() => navigate("/register")}>Registrarse</button>
                        </>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <section style={{
                padding: "80px 24px 60px",
                textAlign: "center",
                background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(0,0,0,0) 60%)",
                position: "relative",
                overflow: "hidden",
            }}>
                <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: -40, left: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)" }} />

                <h1 className="animate-in" style={{
                    fontSize: "clamp(2rem, 5vw, 3.5rem)",
                    fontWeight: 800,
                    margin: "0 0 16px",
                    lineHeight: 1.15,
                    background: "linear-gradient(135deg, var(--gold-300), var(--gold-400), #fff, var(--gold-300))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundSize: "200% 200%",
                    animation: "shimmer 4s ease infinite",
                }}>
                    Tu Estilo, Nuestra Pasión
                </h1>
                <p className="animate-in" style={{ fontSize: "1.15rem", color: "var(--text-secondary)", maxWidth: 560, margin: "0 auto 32px", lineHeight: 1.6 }}>
                    Cortes de cabello premium, barbas perfectas y un servicio de primera clase. Agenda tu cita en segundos.
                </p>
                <div className="animate-in" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button className="btn-gold" onClick={() => navigate(isLoggedIn ? "/cliente" : "/register")} style={{ padding: "14px 32px", fontSize: "1rem", fontWeight: 600 }}>
                        📅 Agendar Cita
                    </button>
                    <a href="#servicios" className="btn-outline" style={{ padding: "14px 32px", fontSize: "1rem", textDecoration: "none" }}>
                        Ver Servicios ↓
                    </a>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 48, flexWrap: "wrap" }}>
                    {[
                        { val: servicios.length || "—", label: "Servicios" },
                        { val: barberos.length || "—", label: "Barberos" },
                        { val: "100%", label: "Satisfacción" },
                    ].map((s, i) => (
                        <div key={i} className="animate-in" style={{ textAlign: "center", animationDelay: `${i * 0.1}s` }}>
                            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--gold-300)" }}>{s.val}</div>
                            <div className="text-muted" style={{ fontSize: "0.85rem" }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Services Section */}
            <section id="servicios" className="container" style={{ padding: "60px 24px" }}>
                <h2 className="animate-in" style={{ textAlign: "center", marginBottom: 8, fontSize: "1.8rem" }}>💈 Nuestros Servicios</h2>
                <p className="text-muted animate-in" style={{ textAlign: "center", marginBottom: 40 }}>Calidad premium a precios justos</p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
                    {servicios.map((s, i) => (
                        <div key={s.id} className="card-section animate-in" style={{
                            padding: 24,
                            textAlign: "center",
                            animationDelay: `${i * 0.08}s`,
                            transition: "transform 0.2s, box-shadow 0.2s",
                            cursor: "default",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(212,175,55,0.12)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                        >
                            <div style={{ fontSize: 32, marginBottom: 12 }}>✂️</div>
                            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>{s.nombre}</h3>
                            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--gold-300)" }}>
                                {formatCOP(s.precio)}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Barbers Section */}
            {barberos.length > 0 && (
                <section className="container" style={{ padding: "40px 24px 60px" }}>
                    <h2 className="animate-in" style={{ textAlign: "center", marginBottom: 8, fontSize: "1.8rem" }}>👥 Nuestros Barberos</h2>
                    <p className="text-muted animate-in" style={{ textAlign: "center", marginBottom: 40 }}>Profesionales con experiencia</p>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
                        {barberos.map((b, i) => (
                            <div key={b.id} className="card-section animate-in" style={{
                                padding: 24,
                                textAlign: "center",
                                animationDelay: `${i * 0.1}s`,
                            }}>
                                <div style={{
                                    width: 64, height: 64, borderRadius: "50%",
                                    background: "linear-gradient(135deg, var(--gold-400), var(--gold-500))",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 24, fontWeight: 700, color: "#000",
                                    margin: "0 auto 12px",
                                }}>
                                    {b.nombre.charAt(0).toUpperCase()}
                                </div>
                                <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }}>{b.nombre}</h3>
                                <span className="badge badge-pending" style={{ fontSize: "0.75rem" }}>💈 Barbero</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Reviews Section */}
            {topReviews.length > 0 && (
                <section className="container" style={{ padding: "40px 24px 60px" }}>
                    <h2 className="animate-in" style={{ textAlign: "center", marginBottom: 8, fontSize: "1.8rem" }}>⭐ Lo que dicen nuestros clientes</h2>
                    <p className="text-muted animate-in" style={{ textAlign: "center", marginBottom: 40 }}>Reseñas reales de clientes satisfechos</p>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                        {topReviews.map((r, i) => (
                            <div key={i} className="card-section animate-in" style={{ padding: 20, animationDelay: `${i * 0.08}s` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <strong>{r.cliente_nombre}</strong>
                                    <span style={{ color: "#ffd700" }}>{"★".repeat(r.puntuacion)}{"☆".repeat(5 - r.puntuacion)}</span>
                                </div>
                                {r.comentario && <p className="text-muted" style={{ margin: 0, fontSize: "0.9rem" }}>{r.comentario}</p>}
                                <div className="text-muted" style={{ marginTop: 8, fontSize: "0.8rem" }}>Barbero: {r.barbero}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* CTA Section */}
            <section style={{
                padding: "60px 24px",
                textAlign: "center",
                background: "linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(0,0,0,0) 100%)",
                borderTop: "1px solid var(--border-subtle)",
            }}>
                <h2 className="animate-in" style={{ fontSize: "1.6rem", marginBottom: 12 }}>¿Listo para un nuevo look?</h2>
                <p className="text-muted animate-in" style={{ marginBottom: 24 }}>Agenda tu cita ahora y disfruta de un servicio premium</p>
                <button className="btn-gold animate-in" onClick={() => navigate(isLoggedIn ? "/cliente" : "/register")} style={{ padding: "14px 40px", fontSize: "1.05rem", fontWeight: 600 }}>
                    Agendar Ahora →
                </button>
            </section>

            {/* Footer */}
            <footer style={{
                padding: "24px",
                textAlign: "center",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
            }}>
                <p style={{ margin: 0 }}>✂️ Barbería Premium — Sistema de Gestión © {new Date().getFullYear()}</p>
            </footer>

            {/* Shimmer animation */}
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
        </div>
    );
}
