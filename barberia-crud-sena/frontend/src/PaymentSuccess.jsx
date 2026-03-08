import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_URL = "http://localhost:3000";

export default function PaymentSuccess() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session_id");
    const token = localStorage.getItem("token") || "";

    const [status, setStatus] = useState("verifying"); // verifying | success | error
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!sessionId) {
            setStatus("error");
            setMessage("No se encontró la sesión de pago.");
            return;
        }

        const verify = async () => {
            try {
                const res = await fetch(
                    `${API_URL}/api/verify-payment?session_id=${sessionId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();

                if (res.ok && data.payment_status === "paid") {
                    setStatus("success");
                    setMessage(data.mensaje || "¡Pago verificado exitosamente!");
                } else {
                    setStatus("error");
                    setMessage(data.mensaje || data.error || "No se pudo verificar el pago.");
                }
            } catch (e) {
                setStatus("error");
                setMessage("Error de conexión al verificar el pago.");
            }
        };

        verify();
    }, [sessionId]);

    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="card-section animate-in" style={{ maxWidth: 480, textAlign: "center", padding: "48px 36px" }}>
                {status === "verifying" && (
                    <>
                        <div className="payment-icon payment-icon--loading">
                            <span className="spinner" style={{ width: 40, height: 40 }} />
                        </div>
                        <h2 style={{ marginTop: 20 }}>Verificando pago...</h2>
                        <p className="text-secondary">Estamos confirmando tu pago con Stripe.</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="payment-icon payment-icon--success">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M8 12l3 3 5-6" />
                            </svg>
                        </div>
                        <h2 style={{ marginTop: 20, color: "var(--success)" }}>¡Pago Exitoso!</h2>
                        <p className="text-secondary" style={{ marginBottom: 28 }}>{message}</p>
                        <button className="btn-gold" onClick={() => navigate("/cliente")}>
                            Volver a mis citas
                        </button>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="payment-icon payment-icon--error">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M15 9l-6 6M9 9l6 6" />
                            </svg>
                        </div>
                        <h2 style={{ marginTop: 20, color: "var(--danger)" }}>Error en el pago</h2>
                        <p className="text-secondary" style={{ marginBottom: 28 }}>{message}</p>
                        <button className="btn-gold" onClick={() => navigate("/cliente")}>
                            Volver a mis citas
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
