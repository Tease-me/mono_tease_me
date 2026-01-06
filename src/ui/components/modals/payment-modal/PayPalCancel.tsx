import { PATHS } from "@/routes/path";
import { useNavigate } from "react-router-dom";

export default function PayPalCancel() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 24, color: "white" }}>
      <h2>Payment cancelled</h2>
      <p style={{ opacity: 0.8 }}>No worries — your balance was not changed.</p>
      <button
        onClick={() => navigate(PATHS.home)}
        style={{
          marginTop: 16,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(255,255,255,0.08)",
          color: "white",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Back home
      </button>
    </div>
  );
}
