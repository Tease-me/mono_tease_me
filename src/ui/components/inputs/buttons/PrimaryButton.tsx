import React, { useState } from 'react';
import styles from "./PrimaryButton.module.css"
import clsx from 'clsx';
export interface PrimaryButtonProps extends React.HTMLAttributes<HTMLDivElement> {
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    text?: string;
    disabled?: boolean;
    selected?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ leftIcon, rightIcon, text, disabled, selected, ...rest }) => {
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

    return (
        <div
            {...rest}
            className={clsx(
                styles["pill-button"],
                styles["button-cta-outer"],
                !disabled && styles["pink"],
                disabled && styles["disabled"],
                (!disabled && hovered) && styles["hover"],
                (!disabled && pressed) && styles["pressed"],
                (!disabled && selected) && styles["selected"],
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
                <div className={styles["button-cta-content-container"]}>
                    {leftIcon && <div className={styles["left-icon"]}>
                        {leftIcon}
                    </div>}
                    {text && <div className={clsx(styles["button-text"])}>{text}</div>}
                    {rightIcon && <div className={styles["right-icon"]}>
                        {rightIcon}
                    </div>}
                </div>
            </div>
            {!disabled && <div className={styles["circle-shine"]} />}
            {!disabled && <div className={styles["circle-shine-02"]} />}
            {!disabled && <div className={styles["circle-shine-03"]} />}
        </div>
    );
};

export default PrimaryButton;