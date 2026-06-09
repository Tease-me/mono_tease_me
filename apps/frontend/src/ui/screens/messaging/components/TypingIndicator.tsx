import React from 'react';
import styles from "./TypingIndicator.module.css"
import LottieAnimation from '@/ui/components/LottieAnimation';
import IndicationTyping from '@/assets/lottie/IndicatorTyping.json'

interface TypingIndicatorProps {
    isAduio?: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isAduio = false }) => {
    return (
        <div className={styles.typing} data-type="typing">
            {isAduio ? (
                "Recording…"
            ) : (
                <>

                    <span className={styles.text}>Typing</span>
                    <span className={styles.typingIndicator}><LottieAnimation autoplay loop animationData={IndicationTyping} /></span>
                </>
            )
            }
        </div >
    );
};

export default TypingIndicator;




