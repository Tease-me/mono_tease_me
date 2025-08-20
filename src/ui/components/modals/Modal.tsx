import { useEffect, useState } from "react";
import clsx from 'clsx';
import styles from "./Modal.module.css";

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    size?: ModalSize;
    closeOnOverlayClick?: boolean;
    closeOnEsc?: boolean;
    className?: string;
    ariaLabel?: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEsc = true,
    className,
    ariaLabel,
    children,
}) => {
    const [openClass, setOpenClass] = useState<string>();

    // Lock body scroll while modal is open
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            setOpenClass(styles.open);
        }, 100);
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    // Close on ESC
    useEffect(() => {
        if (!isOpen || !closeOnEsc) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, closeOnEsc, onClose]);


    return (
        <div
            className={clsx(styles.overlay, isOpen && styles.open)}
            onClick={closeOnOverlayClick ? onClose : undefined}
            role="presentation"
        >
            <div className={clsx(styles.container, styles[`size-${size}`], openClass, className)}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};