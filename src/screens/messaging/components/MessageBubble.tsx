import React from 'react';
import styles from "./MessageBubble.module.css"
import clsx from 'clsx';
import TypingIndicator from './TypingIndicator';
import { Message } from '@/data/models/MessageDataModel';

interface MessageBubbleProps {
    msg?: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg }) => {
    return (
        msg ? <div className={clsx(styles["message"], styles[msg.sender])}>
            {msg.text}
            <span className={styles["time"]}>{msg.time}</span>
        </div> : <div className={clsx(styles["message"], styles["received"])}>
            <TypingIndicator />
        </div>
    );
};

export default MessageBubble;