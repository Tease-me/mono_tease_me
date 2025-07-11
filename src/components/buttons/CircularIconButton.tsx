import React from 'react';
import styles from "./CircularIconButton.module.css"
import clsx from 'clsx';

interface CircularIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {

}

const CircularIconButton: React.FC<CircularIconButtonProps> = ({ ...props }) => {
    return (
        <button className={clsx(styles["circular-icon-button"], props.className)} {...props}>
            {props.children}
        </button>
    );
};

export default CircularIconButton;