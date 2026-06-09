import React from 'react';
import styles from "./BlockingLoader.module.css"
import LoadingSpinner from './LoadingSpinner';

interface BlockingLoaderProps {
}

const BlockingLoader: React.FC<BlockingLoaderProps> = ({ }) => {
    return (
        <div className={styles["container"]}>
            <LoadingSpinner />
        </div>
    );
};

export default BlockingLoader;