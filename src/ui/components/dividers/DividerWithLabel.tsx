import React from 'react';
import styles from "./DividerWithLabel.module.css"

interface DividerWithLabelProps {
    text: string;
}

const DividerWithLabel: React.FC<DividerWithLabelProps> = ({ text }) => {
    return (
        <div className={styles["divider"]}>
            <span>{text}</span>
        </div>
    );
};

export default DividerWithLabel;