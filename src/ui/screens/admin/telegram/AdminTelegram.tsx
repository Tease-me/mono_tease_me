import React from "react";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import s from "./AdminTelegram.module.css";

const AdminTelegram: React.FC = () => {
  return (
    <AdminLayout
      title="Telegram Sessions"
      subtitle="Manage active Telegram sessions for influencers."
    >
      <div className={s.page}>
        <div className={s.card}>
          <div className={s["card-body"]}>
            <div className={s["empty-state"]}>
              Auto-provisioning via Twilio has been removed.
              Basic manual connection endpoints are still available via the API.
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTelegram;
