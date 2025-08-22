import React, { useRef } from 'react';
import IconButton, { IconButtonColor, IconButtonOrientation, IconButtonProps, IconButtonType } from './IconButton';

interface LongPressButtonProps extends IconButtonProps {
    type?: IconButtonType;
    color?: IconButtonColor;
    leftIcon?: React.ReactNode;
    orientation?: IconButtonOrientation;
    text?: string;
    disabled?: boolean;
    selected?: boolean;
    onLongPressStart?: () => void;
    onLongPressEnd?: () => void;
    onShortPress?: () => void;
    onLongPress?: () => void;
    onDragStart?: () => void;
    onDrag?: () => void;
    onDragEnd?: () => void;
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
    const isDragging = useRef(false);
    const startPosition = useRef<{ x: number; y: number } | null>(null);
    const movementThreshold = 5;

    const handleMouseDown = (event: React.MouseEvent) => {
        startPosition.current = { x: event.clientX, y: event.clientY };
        isDragging.current = false;
        startPressTimer();
    };

    const handleMouseUp = () => {
        if (isDragging.current) {
            props.onDragEnd?.();
            isDragging.current = false;
            return;
        }
        clearTimeout(timerRef.current!);
        if (isLongPress.current) {
            onLongPressEnd?.();
            onLongPress?.();
        } else {
            onShortPress?.();
        }
        isLongPress.current = false;
    };

    const handleTouchStart = (event: React.TouchEvent) => {
        const touch = event.touches[0];
        startPosition.current = { x: touch.clientX, y: touch.clientY };
        isDragging.current = false;
        startPressTimer();
    };

    const handleTouchEnd = () => {
        if (isDragging.current) {
            props.onDragEnd?.();
            isDragging.current = false;
            return;
        }
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

    const handleMouseMove = (event: React.MouseEvent) => {
        if (startPosition.current && !isDragging.current) {
            const dx = Math.abs(event.clientX - startPosition.current.x);
            const dy = Math.abs(event.clientY - startPosition.current.y);
            if (dx + dy > movementThreshold) {
                isDragging.current = true;
                clearTimeout(timerRef.current!);
                props.onDragStart?.();
            }
        }
        if (isDragging.current) {
            props.onDrag?.();
        }
    };

    const handleTouchMove = (event: React.TouchEvent) => {
        const touch = event.touches[0];
        if (startPosition.current && !isDragging.current) {
            const dx = Math.abs(touch.clientX - startPosition.current.x);
            const dy = Math.abs(touch.clientY - startPosition.current.y);
            if (dx + dy > movementThreshold) {
                isDragging.current = true;
                clearTimeout(timerRef.current!);
                props.onDragStart?.();
            }
        }
        if (isDragging.current) {
            props.onDrag?.();
        }
    };
    return (
        <IconButton draggable={false}
            {...props}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => e.preventDefault()} />
    );
};

export default LongPressButton;