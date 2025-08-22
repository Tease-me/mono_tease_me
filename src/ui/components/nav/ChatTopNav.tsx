import React from 'react';
import styles from "./ChatTopNav.module.css"
import { useNavigate } from 'react-router-dom';
import ArrowLeftIcon from "@/assets/svg/ArrowLeft.svg?react";
import MoreCircleIcon from "@/assets/svg/ThreeDotCircle.svg?react";
import CallIcon from "@/assets/Call.svg?react";
import clsx from 'clsx';
import IconButton from '../inputs/buttons/IconButton';

interface ChatTopNavProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    onBack?: () => void;
    onMenuClick?: () => void;
    onCallClick?: () => void;
    showBackButton?: boolean;
    showMenuButton?: boolean;
}

const ChatTopNav: React.FC<ChatTopNavProps> = ({ title, onBack, onCallClick, onMenuClick, showBackButton = true, showMenuButton = false }) => {
    const navigate = useNavigate();
    return (
        <div className={styles["chat-header"]}>
            <div className={styles["left-buttons"]}>
                <button className={clsx(styles["back-btn"], !showBackButton && styles["hidden"])} onClick={onBack || (() => navigate(-1))}>
                    <ArrowLeftIcon />
                </button>
            </div>
            <div className={styles["center-title"]}>{title}</div>
            <div className={styles["right-buttons"]}>
                <div>
                    <IconButton leftIcon={<CallIcon />} onClick={onCallClick} className={styles["call-button"]} color='green' text='Call' />
                </div>
                <button className={clsx(styles["menu-button"], !showMenuButton && styles["hidden"])} onClick={onMenuClick} >
                    <MoreCircleIcon />
                </button>
            </div>
        </div>
    );
};

export default ChatTopNav;