import React, { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

type RelationshipRadarProps = {
  trust: number;
  safety: number;
  attraction: number;
  closeness: number;
  height?: number;          // default 260
  color?: string;           // fill/stroke color, default "#a53cfd"
};

const clamp100 = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

const RelationshipRadar: React.FC<RelationshipRadarProps> = ({
  trust,
  safety,
  attraction,
  closeness,
  height = 260,
  color = "#a53cfd",
}) => {
  const data = useMemo(
    () => [
      { metric: "Trust", value: clamp100(trust) },
      { metric: "Closeness", value: clamp100(closeness) },
      { metric: "Attraction", value: clamp100(attraction) },
      { metric: "Safety", value: clamp100(safety) },
    ],
    [trust, safety, attraction, closeness]
  );

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" />
          <PolarRadiusAxis domain={[0, 100]} tickCount={6} />
          <Radar
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.8}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RelationshipRadar;
