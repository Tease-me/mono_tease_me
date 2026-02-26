import styles from "./RelationshipStageProgress.module.css"
import ProgressBar from "./ProgressBar"

type RelationshipStageProgressProps = {
  sentimentScore: number;
  large?: boolean;
  currentStage: string;
  nextStage?: string;
}

export default function RelationshipStageProgress({ sentimentScore, large = false, currentStage, nextStage }: RelationshipStageProgressProps) {
  return (
    <div className={styles.progressBar}>
      <ProgressBar label="Stage progress" value={sentimentScore ?? 0} max={100} compact={!large} />
      <div className={styles.stageLabelArea}>
        <div><p className={styles.body02}>{currentStage || ""}</p></div>
        <div><p className={styles.body02}>{nextStage || ""}</p></div>
      </div>
    </div>
  );
}