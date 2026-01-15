import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { ErrorModalPayload, subscribeErrorModal } from "@/utils/errorModal";
import styles from "./ErrorModalProvider.module.css";

const DEFAULT_TITLE = "Something went wrong";

const ErrorModalProvider = () => {
  const [payload, setPayload] = useState<ErrorModalPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setPayload(null);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeErrorModal((nextPayload) => {
      setPayload(nextPayload);
      setIsOpen(true);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabel="Error notification"
      size="sm"
    >
      <div className={styles.modal}>
        <h3 className={styles.title}>{payload?.title || DEFAULT_TITLE}</h3>
        <p className={styles.message}>{payload?.message}</p>
        {payload?.status && (
          <p className={styles.status}>Error code: {payload.status}</p>
        )}
        <button className={styles.dismissButton} onClick={handleClose}>
          Dismiss
        </button>
      </div>
    </Modal>
  );
};

export default ErrorModalProvider;
