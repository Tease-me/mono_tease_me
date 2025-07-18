import React from 'react';
import styles from "./ChatTopNav.module.css"
import { useNavigate } from 'react-router-dom';
import ArrowLeftIcon from "@/assets/svg/ArrowLeft.svg?react";
import MoreCircleIcon from "@/assets/svg/ThreeDotCircle.svg?react";

interface ChatTopNavProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    onBack?: () => void;
    onMenuClick?: () => void;
    showBackButton?: boolean;
    showMenuButton?: boolean;
}

const ChatTopNav: React.FC<ChatTopNavProps> = ({ title, onBack, onMenuClick, showBackButton = true, showMenuButton = true }) => {
    const navigate = useNavigate();
    return (
        <header className={styles["chat-header"]}>
            <button className={styles["back-btn"]} onClick={onBack || (() => navigate(-1))} style={{ display: showBackButton ? 'block' : 'none' }}>
                <ArrowLeftIcon />
            </button>
            <h2>{title}</h2>
            <button className={styles["menu-button"]} onClick={onMenuClick} style={{ display: showMenuButton ? 'block' : 'none' }}>
                <MoreCircleIcon />
            </button>
        </header>
    );
};

export default ChatTopNav;