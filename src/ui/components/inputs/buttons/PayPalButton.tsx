import React, { useState } from 'react';
import styles from "./PayPalButton.module.css"
import PayPalLogo from '@/assets/logos/pypal.svg'
import clsx from 'clsx';

type PayPalButtonType = "pill" | "square" | "nobg";

interface ButtonPayPalProps extends React.HTMLAttributes<HTMLDivElement> {
    type?: PayPalButtonType;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    text?: string;
    disabled?: boolean;
    selected?: boolean;
}

const PayPalButton: React.FC<ButtonPayPalProps> = ({ type = "pill", leftIcon, rightIcon, text, disabled, selected, ...rest }) => {
    const [hovered, setHovered] = useState(false);
    const [pressed, setPressed] = useState(false);
    const outerStyle: Record<PayPalButtonType, string> = {
        pill: clsx(styles["pill-button"], styles["button-paypal-outer"], styles["paypal"]),
        square: clsx(styles["smooth-button"], styles["button-paypal-outer"], styles["paypal"]),
        nobg: clsx(styles["smooth-button"], styles["button-paypal-outer"], styles["nobg"])
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
        <div className='paypal-container'><div
            {...rest}
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
            <div className={styles["button-paypal-inner"]}>
                <div className={styles["button-paypal-content-container"]}>
                    {leftIcon && <div className={styles["left-icon"]}>
                        {leftIcon}
                    </div>}
                    {text && <div className={clsx(styles["button-text"])}>{text}</div>}
                    {rightIcon && <div className={styles["right-icon"]}>
                        {rightIcon}
                    </div>}
                </div>
            </div>

        </div><div className="powered-by-paypal"><p>Powered by PayPal</p><img className='paypal-logo' src={PayPalLogo} alt="PayPal Logo" /></div><div></div></div>

    );

};

export default PayPalButton;