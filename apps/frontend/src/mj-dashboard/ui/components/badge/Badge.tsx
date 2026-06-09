import React, { HTMLAttributes } from 'react';
import styles from "./Badge.module.css"
import clsx from 'clsx';

export type BadgeType = "success" | "neutral" | "primary" | "danger" | "warning" | "inactive" | "white"

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
    type: BadgeType;
}

const Badge: React.FC<BadgeProps> = ({ type, ...props }) => {
    return (
        <div {...props} className={clsx(styles["badge"], styles[type], props.className)} style={props.style}>
            {props.children}
        </div>
    );
};

export default Badge;