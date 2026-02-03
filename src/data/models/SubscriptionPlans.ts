export type SubscriptionPlan = {
  id: number;
  name: string;
  price_cents: number;
  price_display: string;
  currency: string;
  description: string;
  features: {
    credits_per_month?: number;
    minutes_equivalent?: number;
    priority_support?: boolean;
    exclusive_content?: boolean;
  };
  is_featured: boolean;
};

export type AddonPlan = {
  id: number;
  name: string;
  price_cents: number;
  price_display: string;
  credits_granted: number;
  minutes_equivalent: number;
  currency: string;
  description: string;
  is_featured: boolean;
};

export type SubscriptionPlansResponse = {
  recurring: SubscriptionPlan[];
  addons: AddonPlan[];
};
