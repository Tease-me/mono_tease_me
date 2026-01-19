import MetricRing from "./MetricRing";
import styles from "./InfluencerMetrics.module.css";
import SvgPack from "@/utils/SvgPack";
import { RelationshipDataModel } from "@/data/models/RelationshipDataModel";
import { clsx } from "clsx";

type InfluencerMetricsProps = {
    relationship?: RelationshipDataModel;
    className?: string;
    props?: React.HTMLAttributes<HTMLDivElement>;
};

const clampValue = (value?: number) => {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, value));
};

export default function InfluencerMetrics({
    relationship,
    className,
    props
}: InfluencerMetricsProps) {
    const metrics = [
        { key: "trust", value: relationship?.trust || 0, icon: <SvgPack.Trust /> },
        { key: "closeness", value: relationship?.closeness || 0, icon: <SvgPack.Angles /> },
        { key: "attraction", value: relationship?.attraction || 0, icon: <SvgPack.KissGray /> },
        { key: "safety", value: relationship?.safety || 0, icon: <SvgPack.Shield /> },
    ];

    return (
        <div className={clsx(styles.metricsBar, className)} {...props}>
            {metrics.map((metric) => (
                <div key={metric.key} className={styles.metric}>
                    <MetricRing value={clampValue(metric.value)} icon={metric.icon} />
                </div>
            ))}
        </div>
    );
}
