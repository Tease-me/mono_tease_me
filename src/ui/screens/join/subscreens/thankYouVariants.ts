export const THANK_YOU_VARIANTS = {
  received: "received",
  profileComplete: "profileComplete",
} as const;

export type ThankYouVariant =
  (typeof THANK_YOU_VARIANTS)[keyof typeof THANK_YOU_VARIANTS];
