import React from 'react';
import styles from './NavigationRow.module.css';
import IconButton from './IconButton';
import SvgPack from '@/utils/SvgPack';

type NavigationRowProps = {
  title: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
  rightIcon?: React.ReactNode;
};

const NavigationRow: React.FC<NavigationRowProps> = ({
  title,
  subtitle,
  onClick,
  disabled = false,
  rightIcon,
}) => {
  return (
    <button
      type="button"
      className={styles.row}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className={styles.textBlock}>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      <div className={styles.arrowArea}>
        <IconButton
          type="pill"
          color="black"
          aria-disabled={disabled}
          leftIcon={rightIcon ? rightIcon : <SvgPack.LightArrowRight />}
          className={styles.arrow}
          aria-label="Go"
        />
      </div>
    </button>
  );
};

export default NavigationRow;
