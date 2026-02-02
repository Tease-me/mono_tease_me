import { useEffect, useState } from "react";
import clsx from "clsx";
import styles from "./DisclaimerModal.module.css";
import DisclaimerScreen from "@/ui/screens/disclaimer/DisclaimerScreen";

type DisclaimerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onEnter: () => void;
  onExit: () => void;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  ariaLabel?: string;
  className?: string;
};

export default function DisclaimerModal({
  isOpen,
  onClose,
  onEnter,
  onExit,
  closeOnOverlayClick = false,
  closeOnEsc = true,
  ariaLabel = "Adult content disclaimer",
  className,
}: DisclaimerModalProps) {
  const [openClass, setOpenClass] = useState<string>();

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => setOpenClass(styles.open), 80);
    return () => {
      document.body.style.overflow = prev;
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

  return (
    <div
      className={clsx(styles.overlay, isOpen && styles.open)}
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="presentation"
    >
      <div
        className={clsx(styles.container, openClass, className)}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        <DisclaimerScreen
          onEnter={onEnter}
          onExit={onExit}
        />
      </div>
    </div>
  );
}
