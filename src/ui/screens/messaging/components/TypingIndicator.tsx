import React from 'react';
import styles from "./TypingIndicator.module.css"

interface TypingIndicatorProps {
    isAduio?: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isAduio = false }) => {
    return (
        <div className={styles["typing"]} data-type="typing">
            {isAduio ? "Recording..." : "Typing..."}
            {/* <div className={styles["typing"]} aria-busy="true">
                <div className={styles["typing-dot"]} data-i="0" />
                <div className={styles["typing-dot"]} data-i="1" />
                <div className={styles["typing-dot"]} data-i="2" />
            </div> */}
        </div>
    );
};

export default TypingIndicator;