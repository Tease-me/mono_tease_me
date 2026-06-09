import React from 'react';
import styles from "./VerticalDivider.module.css"

interface VerticalDividerProps {
    children?: never;
}

const VerticalDivider: React.FC<VerticalDividerProps> = ({ }) => {
    return (
        <div className={styles.divider} />
    );
};

export default VerticalDivider;