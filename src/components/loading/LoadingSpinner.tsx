import React from 'react';
import styles from "./LoadingSpinner.module.css"
import LoadingSpinnerIcon from "@/assets/loading.svg?react";
import BackgroundGradient from '../BackgroundGradient';

interface LoadingSpinnerProps {
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ }) => {
    return (
        <div className={styles["loading-spinner-container"]}>
            <div className={styles["loader"]} />
        </div>
    );
};

export default LoadingSpinner;