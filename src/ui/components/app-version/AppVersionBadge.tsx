import { APP_VERSION } from "@/version";
import styles from "./AppVersionBadge.module.css";

export default function AppVersionBadge() {
  return (
    <div className={styles.badge} aria-label={`Application version ${APP_VERSION}`}>
      <span className={styles.label}>Version</span>
      <span>{`v${APP_VERSION}`}</span>
    </div>
  );
}
