import React from 'react';
import styles from "./LoadingSpinner.module.css"
import clsx from 'clsx';

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'small' | 'medium' | 'large';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'medium',
    ...rest
}) => {
    return (
        <div className={clsx(styles['loading-spinner-container'])}
            {...rest}>
            <div className={clsx(styles['loader'], styles[size])} />
        </div >
    );
};

export default LoadingSpinner;