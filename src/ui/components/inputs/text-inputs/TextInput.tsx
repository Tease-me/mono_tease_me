import React, { HTMLAttributes, HTMLInputTypeAttribute } from 'react';
import styles from './TextInput.module.css';
import clsx from 'clsx';

interface TextInputProps extends HTMLAttributes<HTMLInputElement> {
    type?: HTMLInputTypeAttribute;
    placeholder?: string;
    leftIcon?: React.ReactNode;
    leftIconStyles?: { style: React.CSSProperties, hoverStyle?: React.CSSProperties }
    rightIcon?: React.ReactNode;
    rightIconStyles?: { style: React.CSSProperties, hoverStyle?: React.CSSProperties }
    size?: 'small' | 'xsmall' | 'medium';
    value?: string | number | readonly string[];
    readOnly?: boolean;
}

const TextInput: React.FC<TextInputProps> = ({
    type = 'text',
    placeholder,
    leftIcon,
    leftIconStyles,
    rightIcon,
    rightIconStyles,
    size = 'medium',
    className,
    value,
    readOnly,
    onChange,
    ...rest
}) => {
    return (
        <div className={clsx(styles['text-input-container'], className)}>
            {leftIcon && <div className={clsx(styles["icon"], styles["left"])} style={leftIconStyles?.style}>
                {leftIcon}
            </div>}
            <input
                type={type}
                placeholder={placeholder}
                className={clsx(styles['auth-input'], styles[`input-${size}`], !leftIcon && styles["input-left-padding"], !rightIcon && styles["input-right-padding"])}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                {...rest}
            />
            {rightIcon && <div className={clsx(styles["icon"], styles["right"])} style={rightIconStyles?.style}>
                {rightIcon}
            </div>}
        </div>
    );
};

export default TextInput;