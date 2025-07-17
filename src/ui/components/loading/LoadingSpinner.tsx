import React from 'react';
import styles from "./LoadingSpinner.module.css"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ }) => {
    return (
        <div className={styles["loading-spinner-container"]}>
            <div className={styles["loader"]} />
        </div>
    );
};

export default LoadingSpinner;