import React, { useState } from 'react';
import styles from "./PrimaryButton.module.css"
import clsx from 'clsx';
export interface PrimaryButtonProps extends React.HTMLAttributes<HTMLDivElement> {
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    text?: string;
    disabled?: boolean;
    loading?: boolean;
    selected?: boolean;
    variant?: "pink" | "purple";
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
    leftIcon,
    rightIcon,
    text,
    disabled,
    loading,
    selected,
    variant = "pink",
    onClick,
    ...rest
}) => {
    const [hovered, setHovered] = useState(false);
    const [pressed, setPressed] = useState(false);

    const handleMouseEnter = () => {
        setHovered(true);
    }

    const handleMouseLeave = () => {
        setHovered(false);
        setPressed(false);
    }
    const handleMouseDown = () => {
        setPressed(true);
    }

    const handleMouseUp = () => {
        setPressed(false);
    }
    const handleTouchStart = () => {
        setPressed(true);
    }
    const handleTouchEnd = () => {
        setPressed(false);
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled || loading) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        onClick?.(e);
    }

    return (
        <div
            {...rest}
            onClick={handleClick}
            className={clsx(
                styles["pill-button"],
                styles["button-cta-outer"],
                !disabled && styles[variant],
                disabled && styles["disabled"],
                loading && styles["loading"],
                (!disabled && !loading && hovered) && styles["hover"],
                (!disabled && !loading && pressed) && styles["pressed"],
                (!disabled && !loading && selected) && styles["selected"],
                rest.className
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className={styles["button-cta-inner"]}>
                {loading ? (
                    <div className={styles["spinner"]} />
                ) : (
                    <div className={styles["button-cta-content-container"]}>
                        {leftIcon && <div className={styles["left-icon"]}>{leftIcon}</div>}
                        {text && <div className={clsx(styles["button-text"])}>{text}</div>}
                        {rightIcon && <div className={styles["right-icon"]}>{rightIcon}</div>}
                    </div>
                )}
            </div>
            {!disabled && !loading && <div className={styles["circle-shine"]} />}
            {!disabled && !loading && <div className={styles["circle-shine-02"]} />}
            {!disabled && !loading && <div className={styles["circle-shine-03"]} />}
        </div>
    );
};

export default PrimaryButton;
