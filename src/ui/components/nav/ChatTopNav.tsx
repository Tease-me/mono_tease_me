import React, { useContext, useEffect } from 'react';
import styles from "./ChatTopNav.module.css"
import { useNavigate } from 'react-router-dom';
import ArrowLeftIcon from "@/assets/svg/ArrowLeft.svg?react";
import MoreCircleIcon from "@/assets/svg/ThreeDotCircle.svg?react";
import clsx from 'clsx';
import IconButton from '../inputs/buttons/IconButton';
import DropDownMenu, { DropDownMenuDataModel } from '@/ui/components/inputs/dropdown/DropDownMenu';
import SvgPack from '@/utils/SvgPack';
import AdultModeToggleContainer from '../adult-mode-toggle/AdultModeToggleContainer';
import { useTheme } from '@/theme/ThemeProvider';
import { AuthContext } from '@/context/AuthContext';

interface ChatTopNavProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    onBack?: () => void;
    menuItems?: DropDownMenuDataModel[];
    onCallClick?: () => void;
    showBackButton?: boolean;
}

const ChatTopNav: React.FC<ChatTopNavProps> = ({ title, onBack, onCallClick, menuItems, showBackButton = false }) => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const { adultMode, setAdultMode } = useContext(AuthContext);

    useEffect(() => {
        setTheme(adultMode ? 'adult' : 'default');
    }, [adultMode, setTheme]);

    return (
        <div className={styles["chat-header"]}>
            <div className={styles["left-buttons"]}>
                <button className={clsx(styles["back-btn"], !showBackButton && styles["hidden"])} onClick={onBack || (() => navigate(-1))}>
                    <ArrowLeftIcon />
                </button>
                {menuItems && <DropDownMenu menu={menuItems} className={clsx(styles["menu-button"])}>
                    <MoreCircleIcon />
                </DropDownMenu>}
            </div>
            <div className={styles["center-title"]}>
                {title}
                <AdultModeToggleContainer
                    checked={theme === 'adult'}
                    onChange={(checked) => {
                        setAdultMode(checked);
                        setTheme(checked ? 'adult' : 'default');
                    }}
                />
            </div>
            <div className={styles["right-buttons"]}>
                <div>
                    <IconButton leftIcon={<SvgPack.Call />} onClick={onCallClick} className={styles["call-button"]} color='green' text='Call' />
                </div>
            </div>
        </div>
    );
};

export default ChatTopNav;
