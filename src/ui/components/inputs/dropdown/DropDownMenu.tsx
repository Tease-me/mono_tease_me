import React, { useState, useRef, useEffect } from 'react';
import styles from "./DropDownMenu.module.css"
import clsx from 'clsx';

export interface DropDownMenuDataModel {
    id: number;
    icon: React.ReactNode;
    text: string;
    styles?: { style: React.CSSProperties, hoverStyle?: React.CSSProperties, iconStyle?: React.CSSProperties, iconHoverStyle?: React.CSSProperties };
    onClick?: React.MouseEventHandler<HTMLDivElement>;
}

interface DropDownMenuProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    menu: DropDownMenuDataModel[]
}

const DropDownMenu: React.FC<DropDownMenuProps> = ({ menu, children, className, ...rest }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [openLeft, setOpenLeft] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (menuOpen && buttonRef.current && menuRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const menuHeight = menuRef.current.offsetHeight;
            const menuWidth = menuRef.current.offsetWidth;
            const spaceBelow = window.innerHeight - buttonRect.bottom;
            const spaceRight = window.innerWidth - buttonRect.left;
            const spaceLeft = buttonRect.right;

            setOpenUpward(spaceBelow < menuHeight);
            // Align menu to the left edge of the trigger (expanding right) when there is room on the right
            // or when opening to the right would overflow more than opening to the left.
            const alignLeft = spaceRight >= menuWidth || spaceRight >= spaceLeft;
            setOpenLeft(alignLeft);
        }
    }, [menuOpen]);

    return (
        <>
            {menuOpen && <div className={styles["overlay"]} onClick={() => setMenuOpen(prev => !prev)} />}
            <div className={styles.container}>
                <button
                    {...rest}
                    className={clsx(styles["menu-button"], className)}
                    ref={buttonRef}

                    onClick={() => setMenuOpen((prev) => !prev)}
                >
                    {children}
                </button>
                {menuOpen && (
                    <div
                        className={clsx(
                            styles["dropdown-menu"],
                            openUpward && styles["dropdown-menu--top"],
                            openLeft && styles["dropdown-menu--left"]
                        )}
                        ref={menuRef}
                    >
                        {menu.map((item, index) => {
                            return (
                                <React.Fragment key={item.id}>
                                    <div
                                        className={styles["dropdown-item"]}
                                        style={{
                                            ...item.styles?.style,
                                            ...(hoverIndex === index && item.styles?.hoverStyle),
                                        }}
                                        onClick={item.onClick}
                                        onMouseEnter={() => setHoverIndex(index)}
                                        onMouseLeave={() => setHoverIndex(null)}
                                    >
                                        <span style={{ ...item.styles?.iconStyle, ...(hoverIndex === index && item.styles?.iconHoverStyle), }}>{item.icon}</span> {item.text}
                                    </div>
                                    {index < menu.length - 1 && <div className={styles.divider} />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
};

export default DropDownMenu;
