export const LocalStorageKeys = {
  AccessToken: "access_token",
  RefreshToken: "refresh_token",
  AuthUser: "auth_user",
  VisitedWelcome: "visited_welcome",
  ActiveSidebarItem: "active_sidebar_item",
  PreferredChatMode: "preferred_chat_mode",
  DisclaimerSeen: "disclaimer_seen",
  PayPalOrderId: "paypal_topup_order_id",
  PayPalTopUpInfluencerId: "paypal_topup_influencer_id",
  PayPalTopUpAmount: "paypal_topup_amount",
  ParentRefId: "parent_ref_id",
  AdultVerificationTarget: "adultVerificationTarget",
  AdultConfirmed: "adultConfirmed",
  SelectedId: "selected_id",
  InfluencerReferralId: "influencer_referral_id",
  PayPalTopUpInfluencerName: "paypal_topup_influencer_name",
} as const;

export type LocalStorageKeys =
  (typeof LocalStorageKeys)[keyof typeof LocalStorageKeys];
