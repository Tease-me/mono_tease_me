import React from "react";
import SvgPack from "@/utils/SvgPack";

export type RelationshipTooltipLabel = "Trust" | "Closeness" | "Attraction" | "Safety";

export const relationshipTooltipContent: Record<RelationshipTooltipLabel, {
  icon: React.ReactNode;
  title: string;
  headline: string;
  body: string;
  tips: string[];
  cautions: string[];
}> = {
  Trust: {
    icon: <SvgPack.Trust />,
    title: "Trust",
    headline: "She's cautious. Can you be trusted with her attention?",
    body: "You're just getting to know each other. Small acts of support and respect matter more than grand gestures right now.",
    tips: [
      "Be genuine",
      "Listen more than you talk",
      "Show respect",
      "Don't push for personal info too quickly"
    ],
    cautions: [
      "First impressions matter.",
      "Start building trust slowly."
    ]
  },
  Closeness: {
    icon: <SvgPack.Angles />,
    title: "Closeness",
    headline: "You're still distant. Show genuine interest.",
    body: "No emotional connection yet. Build closeness by showing genuine interest in who she is, not just what she looks like.",
    tips: [
      "Ask meaningful questions",
      "Share a bit about yourself",
      "Show affection through words",
      "Be warm and friendly"
    ],
    cautions: [
      "Closeness requires time and emotional investment"
    ]
  },
  Attraction: {
    icon: <SvgPack.KissGray />,
    title: "Attraction",
    headline: "Things are moving forward. Does she see potential in you?",
    body: "There's no spark yet. Build attraction through respectful flirting, genuine compliments, and showing confidence.",
    tips: [
      "Flirt respectfully",
      "Be confident but not arrogant",
      "Give genuine compliments",
      "Never push boundaries"
    ],
    cautions: [
      "Flirting without respect = instant turnoff"
    ]
  },
  Safety: {
    icon: <SvgPack.Shield />,
    title: "Safety",
    headline: "She needs to feel comfortable before opening up.",
    body: "There's no spark yet. Build attraction through respectful flirting, genuine compliments, and showing confidence.",
    tips: [
      "Respect all boundaries",
      "Never pressure",
      "Be gentle",
      "Let her set the pace"
    ],
    cautions: [
      "Safety is easiest to maintain now but also easiest to destroy"
    ]
  }
};
