import { apiClient } from "@/api/apis";
import { BillingServices } from "@/api/services/BillingServices";
import { Paths } from "@/routes/path";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const billing = BillingServices(apiClient);

export default function PayPalReturn() {
  const [msg, setMsg] = useState("Capturing payment...");
  const [detail, setDetail] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenOrderId = params.get("token");
      const order_id =
        tokenOrderId || localStorage.getItem("paypal_topup_order_id");

      setDetail(`token=${tokenOrderId || ""}`);

      if (!order_id) {
        setMsg("Missing PayPal order id.");
        return;
      }

      try {
        setMsg(`Capturing order ${order_id}...`);

        const res = await billing.paypalCapture({ order_id });

        setDetail(JSON.stringify(res, null, 2));

        if (res?.ok) {
          localStorage.removeItem("paypal_topup_order_id");
          setMsg("Top up success! Redirecting...");
          setTimeout(() => navigate(Paths.home), 1200);
        } else {
          setMsg(`Top up not completed. Status: ${res?.status || "UNKNOWN"}`);
        }
      } catch (e: any) {
        // axios error details
        const status = e?.response?.status;
        const data = e?.response?.data;
        setMsg(`Capture failed${status ? ` (HTTP ${status})` : ""}.`);
        setDetail(
          data ? JSON.stringify(data, null, 2) : e?.message || String(e)
        );
      }
    })();
  }, [navigate]);

  return (
    <div style={{ padding: 24, color: "white" }}>
      <h2 style={{ marginBottom: 12 }}>{msg}</h2>
      {detail && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            opacity: 0.85,
            fontSize: 12,
            background: "rgba(255,255,255,0.06)",
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {detail}
        </pre>
      )}
    </div>
  );
}
