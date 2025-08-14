import React, { HTMLAttributes } from 'react';
import styles from "./Badge.module.css"
import clsx from 'clsx';

type BadgeType = "success" | "neutral" | "primary" | "danger" | "warning" | "inactive"

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
    type: BadgeType;
}

const Badge: React.FC<BadgeProps> = ({ type, ...props }) => {
    return (
        <div {...props} className={clsx(styles["badge"], styles[type], props.className)}>
            {props.children}
        </div>
    );
};

export default Badge;