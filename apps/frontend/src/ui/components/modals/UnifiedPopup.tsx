import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import styles from "./UnifiedPopup.module.css";

type PopupSize = "sm" | "md" | "lg" | "xl";

interface UnifiedPopupProps {
  isOpen: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  body: React.ReactNode;
  footer?: React.ReactNode;
  size?: PopupSize;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  ariaLabel?: string;
  horizontalOnDesktop?: boolean;
}

export default function UnifiedPopup({
  isOpen,
  onClose,
  header,
  body,
  footer,
  size = "md",
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className,
  ariaLabel,
  horizontalOnDesktop = false,
}: UnifiedPopupProps) {
  const [openClass, setOpenClass] = useState<string>();

  useEffect(() => {
    if (!isOpen) {
      setOpenClass(undefined);
      return;
    }
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      setOpenClass(styles.open);
    }, 80);
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={clsx(styles.overlay, isOpen && styles.open)}
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="presentation"
    >
      <div
        className={clsx(styles.container, styles[`size-${size}`], openClass, horizontalOnDesktop && styles.horizontalOnDesktop, className)}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        {header && <>
          <div className={styles.header}>{header}</div>
          <div className={styles.spacer} />
        </>}
        <div className={styles.body}>{body}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
