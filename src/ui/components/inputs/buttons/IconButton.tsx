import React, { useState } from 'react';
import styles from "./IconButton.module.css"
import clsx from 'clsx';
type IconButtonType = "pill" | "square";
type IconButtonColor = "black" | "green" | "pink" | "red" | "yellow" | "pink-glass";
type IconButtonOrientation = "horizontal" | "vertical";

interface IconButtonProps extends React.HTMLAttributes<HTMLDivElement> {
    type?: IconButtonType;
    color?: IconButtonColor;
    leftIcon?: React.ReactNode;
    orientation?: IconButtonOrientation;
    text?: string;
    disabled?: boolean;
    selected?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({ type = "pill", color = "pink", leftIcon, orientation = "horizontal", text, disabled, selected, ...rest }) => {
    const [hovered, setHovered] = useState(false);
    const [pressed, setPressed] = useState(false);
    const outerStyle: Record<IconButtonType, string> = {
        pill: clsx(styles["pill-button"], styles["button-cta-outer"], styles["normal"]),
        square: clsx(styles["smooth-button"], styles["button-cta-outer"], styles["normal"]),
    };

    const orientationStyle: Record<IconButtonOrientation, string> = {
        horizontal: "",
        vertical: styles["vertical-button"],
    };

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
                outerStyle[type],
                disabled && styles["disabled"],
                !disabled && styles[color],
                (!disabled && hovered) && styles["hover"],
                (!disabled && pressed) && styles["pressed"],
                (!disabled && selected) && styles["selected"],
                orientationStyle[orientation],
                rest.className
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}>
            <div className={styles["button-cta-inner"]}>
                <div className={styles["button-cta-content-container"]}>
                    {leftIcon && <div className={styles["left-icon"]}>
                        {leftIcon}
                    </div>}
                    {text && <div className={clsx(styles["button-text"], styles[color])}>{text}</div>}
                </div>
            </div>
            {(!disabled && color === "pink-glass") && (
                <>
                    <div className={styles["circle-shine"]}></div>
                    <div className={styles["circle-shine-02"]}></div>
                    <div className={styles["circle-shine-03"]}></div>
                </>
            )}
        </div>
    );
};

export default IconButton;