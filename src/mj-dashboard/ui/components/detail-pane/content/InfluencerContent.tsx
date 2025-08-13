import React from 'react';
import styles from "./InfluencerContent.module.css"

interface InfluencerContentProps {
}

const InfluencerContent: React.FC<InfluencerContentProps> = ({ }) => {
    return (
        <div className={styles["influencer-content"]}>
            <h1>InfluencerContent</h1>
        </div>
    );
};

export default InfluencerContent;