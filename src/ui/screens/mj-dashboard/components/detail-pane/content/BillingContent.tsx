import React from 'react';
import styles from "./BillingContent.module.css"

interface BillingContentProps {
}

const BillingContent: React.FC<BillingContentProps> = ({ }) => {
    return (
        <div className={styles["billing-content"]}>
            <h1>BillingContent</h1>
        </div>
    );
};

export default BillingContent;