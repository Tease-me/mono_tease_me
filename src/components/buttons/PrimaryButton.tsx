import React from 'react';
import styles from "./PrimaryButton.module.css"

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    text?: string;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ ...restProps }) => {
    return (
        <button className={styles["button"]} {...restProps}>
            Sign in with email
        </button>
    );
};

export default PrimaryButton;