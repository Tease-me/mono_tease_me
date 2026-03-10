import React, { useState } from "react";
import { createPortal } from "react-dom";
import styles from "./FullScreenPopup.module.css";

interface FullScreenPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function FullScreenPopup({
  isOpen,
  onClose,
  title,
  children,
}: FullScreenPopupProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  if (!isOpen && !isClosing) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return createPortal(
    <div
      className={`${styles.overlay} ${isClosing ? styles.closing : ""}`}
      onClick={handleOverlayClick}
    >
      <div className={`${styles.popupContainer} ${isClosing ? styles.closing : ""}`}>
        <button className={styles.closeBtn} onClick={handleClose}>
          ✕
        </button>
        <div className={styles.content}>
          <h2 className={styles.title}>{title}</h2>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
