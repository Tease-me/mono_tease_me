import styles from "./RelationshipStageProgress.module.css"
import ProgressBar from "./ProgressBar"

type RelationshipStageProgressProps = {
  stageValue: number;
  large?: boolean;
}

const STAGES = [
  { name: "HATE", min: -Infinity, max: -11 },
  { name: "DISLIKE", min: -10, max: -1 },
  { name: "STRANGERS", min: 0, max: 24 },
  { name: "FRIENDS", min: 25, max: 49 },
  { name: "FLIRTING", min: 50, max: 74 },
  { name: "DATING", min: 75, max: 89 },
  { name: "GIRLFRIEND", min: 90, max: 100 },
];

function getStageInfo(value: number) {
  const currentStage = STAGES.find(s => value >= s.min && value <= s.max);
  const currentIndex = STAGES.indexOf(currentStage || STAGES[0]);
  const nextStage = STAGES[currentIndex + 1];

  return {
    current: currentStage?.name || "STRANGERS",
    next: nextStage?.name || "GIRLFRIEND",
  };
}

export default function RelationshipStageProgress({ stageValue, large = false }: RelationshipStageProgressProps) {
  const { current, next } = getStageInfo(stageValue);

  return (
    <div className={styles.progressBar}>
      <ProgressBar label="Stage progress" value={stageValue ?? 0} max={100} compact={!large} />
      <div className={styles.stageLabelArea}>
        <div><p className={styles.body02}>{current}</p></div>
        <div><p className={styles.body02}>{next}</p></div>
      </div>
    </div>
  );
}