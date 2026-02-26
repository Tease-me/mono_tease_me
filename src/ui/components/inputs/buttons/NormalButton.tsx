import React, { useState } from 'react';
import styles from "./NormalButton.module.css"
import clsx from 'clsx';

type NormalButtonType = "pill" | "square" | "nobg";

interface ButtonNormalProps extends React.HTMLAttributes<HTMLDivElement> {
    type?: NormalButtonType;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    text?: string;
    disabled?: boolean;
    selected?: boolean;
}

const NormalButton: React.FC<ButtonNormalProps> = ({ type = "pill", leftIcon, rightIcon, text, disabled, selected, onClick, ...rest }) => {
    const [hovered, setHovered] = useState(false);
    const [pressed, setPressed] = useState(false);
    const outerStyle: Record<NormalButtonType, string> = {
        pill: clsx(styles["pill-button"], styles["button-normal-outer"], styles["normal"]),
        square: clsx(styles["smooth-button"], styles["button-normal-outer"], styles["normal"]),
        nobg: clsx(styles["smooth-button"], styles["button-normal-outer"], styles["nobg"])
    };
    const handleMouseEnter = () => {
        if (disabled) return;
        setHovered(true);
    }

    const handleMouseLeave = () => {
        setHovered(false);
        setPressed(false);
    }

    const handleMouseDown = () => {
        if (disabled) return;
        setPressed(true);
    }

    const handleMouseUp = () => {
        setPressed(false);
    }

    const handleTouchStart = () => {
        if (disabled) return;
        setPressed(true);
    }

    const handleTouchEnd = () => {
        setPressed(false);
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) {
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
                outerStyle[type],
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
            <div className={styles["button-normal-inner"]}>
                <div className={styles["button-normal-content-container"]}>
                    {leftIcon && <div className={styles["left-icon"]}>
                        {leftIcon}
                    </div>}
                    {text && <div className={clsx(styles["button-text"])}>{text}</div>}
                    {rightIcon && <div className={styles["right-icon"]}>
                        {rightIcon}
                    </div>}
                </div>
            </div>
        </div>
    );
};

export default NormalButton;