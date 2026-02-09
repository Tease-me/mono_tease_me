import clsx from "clsx";
import styles from "./ProgressBar.module.css";
import { ReactNode, useState } from "react";
import SvgPack from "@/utils/SvgPack";
import { Modal } from "@/ui/components/modals/Modal";
import RelationshipTooltip from "@/ui/components/cards/RelationshipTooltip";
import { RelationshipTooltipLabel, relationshipTooltipContent } from "@/ui/components/cards/relationshipTooltipData";

type ProgressBarProps = {
  label: string;
  value: number;
  max: number;
  icon?: ReactNode;
  compact?: boolean;
  mutedLabel?: boolean;
  className?: string;
  showInfoIcon?: boolean;
  tooltipLabel?: RelationshipTooltipLabel;
};

export default function ProgressBar({
  label,
  value,
  max,
  icon,
  compact = false,
  mutedLabel = false,
  className,
  showInfoIcon = false,
  tooltipLabel
}: ProgressBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const pct = value / max * 100;
  const clamped = Math.max(0, Math.min(100, pct));

  const handleClickInfo = () => {
    if (tooltipLabel && relationshipTooltipContent[tooltipLabel]) {
      setShowTooltip(true);
    }
  }

  return (
    <>
      <div className={clsx(styles.wrap, className)}>
        <div className={styles.header}>
          <div className={styles.left}>
            {icon && <span className={styles.icon}>{icon}</span>}
            <span className={clsx(styles.label, mutedLabel && styles.labelMuted)}>
              {label}
            </span>
            {showInfoIcon && tooltipLabel && (
              <span className={clsx(styles.icon, styles.infoIcon)} onClick={handleClickInfo}>
                <SvgPack.InfoCircleGray />
              </span>
            )}
          </div>
          <span className={styles.value}>{value.toFixed(0)}/{max}</span>
        </div>
        <div className={clsx(styles.track, compact && styles.trackCompact)}>
          <div
            className={clsx(styles.fill, compact && styles.fillCompact)}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>

      {showTooltip && tooltipLabel && (
        <Modal isOpen onClose={() => setShowTooltip(false)} className={styles.tooltipModal}>
          <RelationshipTooltip label={tooltipLabel} />
        </Modal>
      )}
    </>
  );
}
