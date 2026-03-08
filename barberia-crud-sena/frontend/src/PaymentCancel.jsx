import { useNavigate } from "react-router-dom";

export default function PaymentCancel() {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="card-section animate-in" style={{ maxWidth: 480, textAlign: "center", padding: "48px 36px" }}>
                <div className="payment-icon payment-icon--warning">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                    </svg>
                </div>
                <h2 style={{ marginTop: 20, color: "var(--gold-400)" }}>Pago Cancelado</h2>
                <p className="text-secondary" style={{ marginBottom: 12 }}>
                    Tu pago no fue procesado. La cita sigue activa pero sin pagar.
                </p>
                <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 28 }}>
                    Puedes pagar en cualquier momento desde tu panel de citas.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button className="btn-gold" onClick={() => navigate("/cliente")}>
                        Volver a mis citas
                    </button>
                </div>
            </div>
        </div>
    );
}
