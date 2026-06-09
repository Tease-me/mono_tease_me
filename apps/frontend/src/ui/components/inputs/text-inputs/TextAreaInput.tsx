import React, { forwardRef, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './TextAreaInput.module.css';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    placeholder?: string;
    leftIcon?: React.ReactNode;
    leftIconStyles?: { style: React.CSSProperties; hoverStyle?: React.CSSProperties };
    rightIcon?: React.ReactNode;
    rightIconStyles?: { style: React.CSSProperties; hoverStyle?: React.CSSProperties };
    size?: 'small' | 'xsmall' | 'medium';
    containerClassName?: string;
}

const TextAreaInput = forwardRef<HTMLTextAreaElement, TextAreaProps>(
    (
        {
            placeholder,
            leftIcon,
            leftIconStyles,
            rightIcon,
            rightIconStyles,
            size = 'medium',
            className,
            containerClassName,
            ...rest
        },
        ref
    ) => {
        return (
            <div className={clsx(styles['text-input-container'], containerClassName)}>
                {leftIcon && (
                    <div className={clsx(styles['icon'], styles['left'])} style={leftIconStyles?.style}>
                        {leftIcon}
                    </div>
                )}

                <textarea
                    ref={ref}
                    placeholder={placeholder}
                    className={clsx(
                        styles['textarea'],
                        styles[`input-${size}`],
                        className,
                        !leftIcon && styles['input-left-padding'],
                        !rightIcon && styles['input-right-padding']
                    )}
                    {...rest}
                />

                {rightIcon && (
                    <div className={clsx(styles['icon'], styles['right'])} style={rightIconStyles?.style}>
                        {rightIcon}
                    </div>
                )}
            </div>
        );
    }
);

TextAreaInput.displayName = 'TextAreaInput';
export default TextAreaInput;
