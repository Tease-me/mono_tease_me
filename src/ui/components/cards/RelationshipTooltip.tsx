import clsx from "clsx";
import styles from "./RelationshipTooltip.module.css";
import iconCheckCircle from "@/assets/svg/iconCheckCircle.svg";
import iconCross from "@/assets/svg/iconCross.svg";
import { RelationshipTooltipLabel, relationshipTooltipContent } from "./relationshipTooltipData";

type RelationshipTooltipProps = {
  label: RelationshipTooltipLabel;
  className?: string;
};

export default function RelationshipTooltip({ label, className }: RelationshipTooltipProps) {
  const content = relationshipTooltipContent[label];
  return (
    <div className={clsx(styles.card, className)}>
      <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <span className={styles.icon}>{content.icon}</span>
          <span className={styles.title}>{content.title}</span>
        </div>
      </div>
      <div className={styles.headline}>{content.headline}</div>
      <div className={styles.body}>{content.body}</div>
      <div className={styles.tipsCard}>
        <div className={styles.tipsTitle}>Relationship Stage Tips</div>
        <ul className={styles.tipList}>
          {content.tips.map((tip) => (
            <li key={tip} className={styles.tipItem}>
              <img className={styles.tipIcon} src={iconCheckCircle} alt="" />
              <span>{tip}</span>
            </li>
          ))}
          {content.cautions.map((tip) => (
            <li key={tip} className={clsx(styles.tipItem, styles.caution)}>
              <img className={styles.tipIcon} src={iconCross} alt="" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
