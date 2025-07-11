import React from 'react';
import styles from "./PrimaryButton.module.css"

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {

}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ }) => {
    return (
        <button className={styles["button"]}>
            Sign in with email
        </button>
    );
};

export default PrimaryButton;