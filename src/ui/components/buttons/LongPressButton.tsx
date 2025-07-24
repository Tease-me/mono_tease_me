import React, { useRef } from 'react';
import styles from "./LongPressButton.module.css"
import CircularIconButton, { CircularIconButtonProps } from './CircularIconButton';

interface LongPressButtonProps extends CircularIconButtonProps {
    onLongPressStart?: () => void;
    onLongPressEnd?: () => void;
    onShortPress?: () => void;
    onLongPress?: () => void;
}

const LongPressButton: React.FC<LongPressButtonProps> = ({
    onLongPressStart,
    onLongPressEnd,
    onShortPress,
    onLongPress,
    ...props
}) => {
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);
    const isLongPress = useRef(false);

    const handleMouseDown = () => {
        startPressTimer();
    };

    const handleMouseUp = () => {
        clearTimeout(timerRef.current!);
        if (isLongPress.current) {
            onLongPressEnd?.();
            onLongPress?.();
        } else {
            onShortPress?.();
        }
        isLongPress.current = false;
    };

    const handleTouchStart = () => {
        startPressTimer();
    };

    const handleTouchEnd = () => {
        clearTimeout(timerRef.current!);
        if (isLongPress.current) {
            onLongPressEnd?.();
            onLongPress?.();
        } else {
            onShortPress?.();
        }
        isLongPress.current = false;
    };

    function startPressTimer() {
        isLongPress.current = false;
        timerRef.current = setTimeout(() => {
            isLongPress.current = true;
            onLongPressStart?.();
        }, 500);
    }
    return (
        <CircularIconButton draggable={false}
            {...props}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleMouseUp}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()} />
    );
};

export default LongPressButton;