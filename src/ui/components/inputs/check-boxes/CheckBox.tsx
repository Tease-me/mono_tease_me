import React from 'react';
import styles from './CheckBox.module.css';
import CheckIcon from '@/assets/svg/Check.svg?react';
import clsx from 'clsx';

export interface CheckBoxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
}

const CheckBox: React.FC<CheckBoxProps> = ({
    ...props
}) => {
    const controlledProps = props.checked !== undefined ? { checked: props.checked } : {};

    return (
        <label
            className={clsx(styles.wrapper, props.disabled ? styles.disabled : '', props.className)}
            htmlFor={props.id}
            style={props.style}
        >
            <input
                id={props.id}
                name={props.name}
                type="checkbox"
                className={styles.input}
                disabled={props.disabled}
                defaultChecked={props.defaultChecked}
                {...controlledProps}
                onChange={(e) => props.onChange?.(e.target.checked, e)}
            />
            <span className={styles.box} aria-hidden="true">
                <CheckIcon className={styles.checkIcon} />
            </span>
            <span className={styles.label}>{props.children}</span>
        </label>
    );
};

export default CheckBox;