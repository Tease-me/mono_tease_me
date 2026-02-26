import styles from "./RelatioshipAffinities.module.css"
import ProgressBar from "./ProgressBar"
import SvgPack from "@/utils/SvgPack"

type props = {
  trust: number;
  closeness: number;
  attraction: number;
  safety: number;
  large?: boolean;
}


export default function RelationshipAffinities({ trust, closeness, attraction, safety, large = false }: props) {

  return (
    <div className={styles.container}>
      <ProgressBar icon={<SvgPack.Trust />} compact={!large} label="Trust" value={trust ?? 0} max={100} showInfoIcon tooltipLabel="Trust" />
      <ProgressBar icon={<SvgPack.Angles />} compact={!large} label="Closeness" value={closeness ?? 0} max={100} showInfoIcon tooltipLabel="Closeness" />
      <ProgressBar icon={<SvgPack.KissGray />} compact={!large} label="Attraction" value={attraction ?? 0} max={100} showInfoIcon tooltipLabel="Attraction" />
      <ProgressBar icon={<SvgPack.Shield />} compact={!large} label="Safety" value={safety ?? 0} max={100} showInfoIcon tooltipLabel="Safety" />
    </div>)
}