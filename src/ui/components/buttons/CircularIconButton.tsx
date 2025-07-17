import React from 'react';
import styles from "./CircularIconButton.module.css"
import clsx from 'clsx';

interface CircularIconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    text?: string;
    icon?: React.ReactNode;
    size?: "small" | "medium" | "large";
    variant?: "primary" | "secondary" | "tertiary";
}

const CircularIconButton = ({ text, icon, size = "medium", variant = "primary", ...props }: CircularIconButtonProps) => {
    const getButtonClassName = () => {
        if (text && icon) {
            return styles["button-with-text-and-icon"];
        } else if (text) {
            return styles["button-with-text-only"];
        } else if (icon) {
            return styles["button-with-icon-only"];
        }
    }
    return (
        <button {...props} className={clsx(styles["button"], getButtonClassName(), styles[size], styles[variant], props.className)} >
            <span className={styles["contents"]}>
                {icon && <span className={styles["icon-container"]}>
                    {icon}
                </span>}
                {text && <span className={styles["text-container"]}>
                    {text}
                </span>}
            </span>
        </button>
    );
};

export default CircularIconButton;