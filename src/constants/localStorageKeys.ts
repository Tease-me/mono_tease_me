export const LocalStorageKeys = {
  AccessToken: "access_token",
  RefreshToken: "refresh_token",
  AuthUser: "auth_user",
  VisitedWelcome: "visited_welcome",
  ActiveSidebarItem: "active_sidebar_item",
  PreferredChatMode: "preferred_chat_mode",
  DisclaimerSeen: "disclaimer_seen",
  CheckoutId: "checkout_id",
  TopUpInfluencerId: "topup_influencer_id",
  TopUpAmount: "topup_amount",
  ParentRefId: "parent_ref_id",
  JoinAttribution: "join_attribution",
  AdultVerificationTarget: "adultVerificationTarget",
  AdultConfirmed: "adultConfirmed",
  SelectedId: "selected_id",
  InfluencerReferralId: "influencer_referral_id",
  TopUpInfluencerName: "topup_influencer_name",
} as const;

export type LocalStorageKeys =
  (typeof LocalStorageKeys)[keyof typeof LocalStorageKeys];
