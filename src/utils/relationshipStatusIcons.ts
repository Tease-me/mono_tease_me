import type { ComponentType } from "react";
import SvgPack from "@/utils/SvgPack";
import React from "react";

export type RelationshipStatus =
  | "HATE"
  | "DISLIKE"
  | "STRANGERS"
  | "TALKING"
  | "FLIRTING"
  | "DATING"
  | "GIRLFRIEND";

const STATUS_ICON_MAP: Record<RelationshipStatus, ComponentType> = {
  HATE: SvgPack.DangerTriangleSmall,
  DISLIKE: SvgPack.Cross,
  STRANGERS: SvgPack.Users,
  TALKING: SvgPack.Chat,
  FLIRTING: SvgPack.KissGray,
  DATING: SvgPack.Heart,
  GIRLFRIEND: SvgPack.Crown,
};

export function getRelationshipStatusIcon(status?: string): React.ReactNode | undefined {
  if (!status) return undefined;
  const normalized = status.toUpperCase() as RelationshipStatus;
  return React.createElement(STATUS_ICON_MAP[normalized] || STATUS_ICON_MAP.STRANGERS);
}
