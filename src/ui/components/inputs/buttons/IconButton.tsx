import React, { useState } from 'react';
import styles from "./IconButton.module.css"
import clsx from 'clsx';
export type IconButtonType = "pill" | "square";
export type IconButtonColor = "black" | "green" | "pink" | "red" | "yellow" | "pink-glass";
export type IconButtonOrientation = "horizontal" | "vertical";

export interface IconButtonProps extends React.HTMLAttributes<HTMLDivElement> {
    type?: IconButtonType;
    color?: IconButtonColor;
    leftIcon?: React.ReactNode;
    orientation?: IconButtonOrientation;
    text?: string;
    disabled?: boolean;
    selected?: boolean;
    redText?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({ type = "pill", color = "pink", leftIcon, redText = false, orientation = "horizontal", text, disabled, selected, ...rest }) => {
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

    const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
        setHovered(true);
        rest.onMouseEnter?.(event);
    }

    const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
        setHovered(false);
        setPressed(false);
        rest.onMouseLeave?.(event);
    }

    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        setPressed(true);
        rest.onMouseDown?.(event);
    }

    const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
        setPressed(false);
        rest.onMouseUp?.(event);
    }

    const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        setPressed(true);
        rest.onTouchStart?.(event);
    }

    const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
        setPressed(false);
        rest.onTouchEnd?.(event);
    }

    return (
        <div
            {...rest}
            className={clsx(
                outerStyle[type],
                disabled && styles["disabled"],
                (!text && type === "pill") && styles["icon-only"],
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
                    {text && (
                        <div className={clsx(styles["button-text"], styles[color], redText && styles.redText)}>
                            {text}
                        </div>
                    )}

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