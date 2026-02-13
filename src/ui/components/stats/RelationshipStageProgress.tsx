import styles from "./RelationshipStageProgress.module.css"
import ProgressBar from "./ProgressBar"

type RelationshipStageProgressProps = {
  currentStage: string;
  stageValue: number;
  large?: boolean;
}

export default function RelationshipStageProgress({ currentStage, stageValue, large = false }: RelationshipStageProgressProps) {
  return (
    <div className={styles.progressBar}>
      <ProgressBar mutedLabel label="Relationship Statistics" value={stageValue ?? 0} max={100} compact={!large} />
      <div className={styles.stageLabelArea}>
        <div><p>{currentStage}</p></div>
        <div><p>nextStage</p></div>
      </div>
    </div>
  );
}