import React, { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

type RelationshipRadarProps = {
  trust: number;
  safety: number;
  attraction: number;
  closeness: number;
  height?: number;          // default 260
  width?: number;           // default 320
  color?: string;           // fill/stroke color, default "hsl(340, 100%, 59%)"
};

const clamp100 = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

const RelationshipRadar: React.FC<RelationshipRadarProps> = ({
  trust,
  safety,
  attraction,
  closeness,
  height = 260,
  width = 320,
  color = "hsl(340, 100%, 59%)",
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

  if (height <= 0 || width <= 0) return null;

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <RadarChart
        data={data}
        width={width}
        height={height}
        margin={{ top: 30, right: 40, bottom: 30, left: 90 }}
      >
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
    </div>
  );
};

export default RelationshipRadar;
