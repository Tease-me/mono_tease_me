import React, { useContext } from 'react';
import styles from "./ChatTopNav.module.css"
import { useNavigate } from 'react-router-dom';
import ArrowLeftIcon from "@/assets/svg/ArrowLeft.svg?react";
import MoreCircleIcon from "@/assets/svg/ThreeDotCircle.svg?react";
import clsx from 'clsx';
import IconButton from '../inputs/buttons/IconButton';
import DropDownMenu, { DropDownMenuDataModel } from '@/ui/components/inputs/dropdown/DropDownMenu';
import SvgPack from '@/utils/SvgPack';

import LogoutIcon from "@/assets/svg/Logout.svg?react";
import ProfileIcon from "@/assets/svg/Profile.svg?react";
import { AuthContext } from '@/context/AuthContext';

interface ChatTopNavProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    onBack?: () => void;
    onMenuClick?: () => void;
    onCallClick?: () => void;
    showBackButton?: boolean;
    showMenuButton?: boolean;
}

const ChatTopNav: React.FC<ChatTopNavProps> = ({ title, onBack, onCallClick, showBackButton = false, showMenuButton = false }) => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const testDataDropDown: DropDownMenuDataModel[] = [
        {
            id: 1,
            icon: <ProfileIcon />,
            text: "My Profile",
            onClick: () => {
                navigate("/profile");
            },
        },
        {
            id: 4,
            icon: <LogoutIcon />,
            text: "Logout",
            styles: {
                style: { color: "var(--color-alert)" },
                hoverStyle: { color: "var(--color-primary)" },
                iconStyle: { color: "var(--color-primary)" },
            },
            onClick: () => {
                logout();
            },
        },
    ];

    return (
        <div className={styles["chat-header"]}>
            <div className={styles["left-buttons"]}>
                <button className={clsx(styles["back-btn"], !showBackButton && styles["hidden"])} onClick={onBack || (() => navigate(-1))}>
                    <ArrowLeftIcon />
                </button>
                <DropDownMenu menu={testDataDropDown} className={clsx(styles["menu-button"], !showMenuButton && styles["hidden"])}>
                    <MoreCircleIcon />
                </DropDownMenu>
            </div>
            <div className={styles["center-title"]}>{title}</div>
            <div className={styles["right-buttons"]}>
                <div>
                    <IconButton leftIcon={<SvgPack.Call />} onClick={onCallClick} className={styles["call-button"]} color='green' text='Call' />
                </div>
            </div>
        </div>
    );
};

export default ChatTopNav;