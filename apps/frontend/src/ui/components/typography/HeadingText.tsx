import React, { HTMLAttributes } from 'react';
import styles from "./HeadingText.module.css"
import clsx from 'clsx';

interface HeadingTextProps extends Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> {
    children: string;
}

const HeadingText: React.FC<HeadingTextProps> = ({ children, ...props }) => {
    return (
        <h1 {...props} className={clsx(styles["title"], props.className)}>{children}</h1>
    );
};

export default HeadingText;