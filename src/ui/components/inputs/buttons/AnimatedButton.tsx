import React from 'react';
import styles from "./AnimatedButton.module.css"
import IconButton, { IconButtonColor, IconButtonOrientation, IconButtonType } from './IconButton';
import clsx from 'clsx';

interface AnimatedButtonProps {
    type?: IconButtonType;
    color?: IconButtonColor;
    leftIcon?: React.ReactNode;
    orientation?: IconButtonOrientation;
    text?: string;
    disabled?: boolean;
    selected?: boolean;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({ ...props }) => {
    return (
        <IconButton draggable={false}
            {...props}
            className={clsx(!props.disabled && styles["animated-button"])}
            onContextMenu={(e) => e.preventDefault()} />
    );
};

export default AnimatedButton;