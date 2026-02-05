import type { ComponentType } from "react";
import SvgPack from "@/utils/SvgPack";
import React from "react";

export type RelationshipStatus =
  | "HATE"
  | "DISLIKE"
  | "STRANGERS"
  | "FRIENDLY"
  | "FLIRTING"
  | "DATING"
  | "GIRLFRIEND";

const STATUS_ICON_MAP: Record<RelationshipStatus, ComponentType> = {
  HATE: SvgPack.RelHate,
  DISLIKE: SvgPack.RelDislike,
  STRANGERS: SvgPack.RelStrangers,
  FRIENDLY: SvgPack.RelTalking,
  FLIRTING: SvgPack.RelFlirting,
  DATING: SvgPack.RelDating,
  GIRLFRIEND: SvgPack.RelInLove,
};

const STATUS_LABEL_MAP: Record<RelationshipStatus, string> = {
  HATE: "Hate",
  DISLIKE: "Dislike",
  STRANGERS: "Stranger",
  FRIENDLY: "Friendly",
  FLIRTING: "Flirting",
  DATING: "Dating",
  GIRLFRIEND: "Girlfriend",
};

export function getRelationshipStatusIcon(status?: string): React.ReactNode | undefined {
  if (!status) return undefined;
  const normalized = status.toUpperCase() as RelationshipStatus;
  return React.createElement(STATUS_ICON_MAP[normalized] || STATUS_ICON_MAP.STRANGERS);
}

export function getRelationshipStatusLabel(status?: string): string | undefined {
  if (!status) return undefined;
  const normalized = status.toUpperCase() as RelationshipStatus;
  return STATUS_LABEL_MAP[normalized] || STATUS_LABEL_MAP.STRANGERS;
}
