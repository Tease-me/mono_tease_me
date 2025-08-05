import React, { HTMLAttributes } from 'react';
import styles from './ButtonRow.module.css';
import clsx from 'clsx';

interface ButtonRowProps extends HTMLAttributes<HTMLDivElement> { }

const ButtonRow: React.FC<ButtonRowProps> = ({ ...restProps }) => (
    <div {...restProps} className={clsx(styles.row, restProps.className)} >
        {React.Children.map(restProps.children, (child) => (
            <div className={styles.cell}>{child}</div>
        ))}
    </div>
);

export default ButtonRow;