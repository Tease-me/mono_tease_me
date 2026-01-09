import React, { useEffect } from 'react';
import styles from "./ChatTopNav.module.css"
import { useNavigate } from 'react-router-dom';
import ArrowLeftIcon from "@/assets/svg/ArrowLeft.svg?react";
import MoreCircleIcon from "@/assets/svg/ThreeDotCircle.svg?react";
import clsx from 'clsx';
import IconButton from '../inputs/buttons/IconButton';
import DropDownMenu, { DropDownMenuDataModel } from '@/ui/components/inputs/dropdown/DropDownMenu';
import SvgPack from '@/utils/SvgPack';
import AdultModeToggle from '../adult-mode-toggle/AdultModeToggle';
import { useTheme } from '@/theme/ThemeProvider';

interface ChatTopNavProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    onBack?: () => void;
    menuItems?: DropDownMenuDataModel[];
    onCallClick?: () => void;
    showBackButton?: boolean;
    adultMode?: boolean;
    onAdultModeChange?: (checked: boolean) => void;
}

const ChatTopNav: React.FC<ChatTopNavProps> = ({
    title,
    onBack,
    onCallClick,
    menuItems,
    showBackButton = false,
    adultMode,
    onAdultModeChange
}) => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (typeof adultMode === "boolean") {
            setTheme(adultMode ? 'adult' : 'default');
        }
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
                {onAdultModeChange && (
                    <AdultModeToggle
                        checked={theme === 'adult'}
                        onChange={(checked) => {
                            onAdultModeChange(checked);
                        }}
                    />
                )}
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
