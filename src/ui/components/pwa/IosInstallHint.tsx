import { useEffect, useMemo, useState } from "react";
import styles from "./IosInstallHint.module.css";

const DISMISSED_KEY = "ios_install_hint_dismissed_v1";

function isIosDevice() {
  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const touchPoints = window.navigator.maxTouchPoints || 0;
  return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);
}

function isSafariBrowser() {
  const ua = window.navigator.userAgent;
  const hasSafari = /Safari/i.test(ua);
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser/i.test(ua);
  return hasSafari && !isOtherIOSBrowser;
}

function isStandaloneMode() {
  const mediaQueryStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return mediaQueryStandalone || navigatorWithStandalone.standalone === true;
}

export default function IosInstallHint() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  const visible = useMemo(() => {
    return isIosDevice() && isSafariBrowser() && !isStandaloneMode() && !dismissed;
  }, [dismissed]);

  const onDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Ignore storage failures.
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <aside className={styles.banner} aria-live="polite">
      <p className={styles.text}>
        <span className={styles.title}>Install TeaseMe</span>
        <br />
        Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
      </p>
      <button
        type="button"
        className={styles.closeButton}
        onClick={onDismiss}
        aria-label="Dismiss install hint"
      >
        ×
      </button>
    </aside>
  );
}
