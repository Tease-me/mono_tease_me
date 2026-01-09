const COMPANY_NAME = "TeaseMe";
const SUPPORT_EMAIL = "support@teaseme.live";
const LEGAL_EMAIL = "legal@teaseme.live";
const lastUpdated = "23 December 2025";

export const terms = {

  terms: {
    title: "Terms and Conditions",
    lastUpdated,
    intro: [
      `These Terms govern your use of ${COMPANY_NAME}. By using the platform you agree to these Terms.`,
    ],
    sections: [
      {
        heading: "Service Description",
        paragraphs: [
          `${COMPANY_NAME} provides AI-generated conversational entertainment services. All interactions are simulated and automated.`,
        ],
      },
      {
        heading: "Eligibility",
        paragraphs: [`Users must be at least 18 years old to use the platform.`],
      },
      {
        heading: "Payments",
        paragraphs: [
          `Payments are processed via third-party providers. We do not store full card data.`,
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          `${COMPANY_NAME} is not liable for indirect or consequential damages.`,
        ],
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    lastUpdated,
    intro: [`This policy explains how ${COMPANY_NAME} collects and protects data.`],
    sections: [
      {
        heading: "Data Collection",
        paragraphs: [
          `We collect account, usage, and transactional metadata necessary to provide the service.`,
        ],
      },
      {
        heading: "Data Sharing",
        paragraphs: [
          `Data is shared only with essential service providers such as payment processors and hosting providers.`,
        ],
      },
      {
        heading: "User Rights",
        paragraphs: [
          `Users may request access or deletion by contacting ${LEGAL_EMAIL}.`,
        ],
      },
    ],
  },

  refunds: {
    title: "Refund Policy",
    lastUpdated,
    intro: [`This policy explains refund eligibility.`],
    sections: [
      {
        heading: "Refund Process",
        paragraphs: [
          `Refunds are processed back to the original payment method upon approval.`,
        ],
      },
      {
        heading: "Subscriptions",
        paragraphs: [
          `Subscription fees are non-refundable once the billing cycle begins unless required by law.`,
        ],
      },
    ],
  },

  subscriptions: {
    title: "Subscription Policy",
    lastUpdated,
    intro: [`This policy explains recurring billing.`],
    sections: [
      {
        heading: "Billing",
        paragraphs: [
          `Subscriptions are billed monthly until cancelled.`,
        ],
      },
      {
        heading: "Cancellation",
        paragraphs: [
          `Users may cancel at any time through account settings.`,
        ],
      },
    ],
  },

  acceptableUse: {
    title: "Acceptable Use Policy",
    lastUpdated,
    intro: [`Rules for safe and lawful platform use.`],
    sections: [
      {
        heading: "Prohibited Use",
        paragraphs: [`Users must not engage in illegal or harmful activities.`],
      },
    ],
  },

  adultContent: {
    title: "Adult Content Policy",
    lastUpdated,
    intro: [`Adult features are restricted to users aged 18+.`],
    sections: [
      {
        heading: "Restrictions",
        paragraphs: [
          `No illegal, exploitative, or harmful content is permitted.`,
        ],
      },
    ],
  },

  aiDisclosure: {
    title: "AI Disclosure Policy",
    lastUpdated,
    intro: [`All conversations are AI-generated.`],
    sections: [
      {
        heading: "AI Nature",
        paragraphs: [
          `No real human participates in conversations.`,
        ],
      },
    ],
  },

  contentModeration: {
    title: "Content Moderation Policy",
    lastUpdated,
    intro: [`We enforce safety controls on content.`],
    sections: [
      {
        heading: "Moderation",
        paragraphs: [
          `Automated and manual review may be applied.`,
        ],
      },
    ],
  },

  dataRetention: {
    title: "Data Retention & Deletion Policy",
    lastUpdated,
    intro: [`We retain data only as necessary.`],
    sections: [
      {
        heading: "Retention",
        paragraphs: [
          `Transaction records are retained for legal compliance.`,
        ],
      },
    ],
  },

  ageVerification: {
    title: "Age Verification Statement",
    lastUpdated,
    intro: [`Users must confirm they are 18+.`],
    sections: [
      {
        heading: "Verification",
        paragraphs: [
          `False age declaration may result in termination.`,
        ],
      },
    ],
  },

  cookies: {
    title: "Cookie Policy",
    lastUpdated,
    intro: [`Cookies help operate and improve the site.`],
    sections: [
      {
        heading: "Cookie Usage",
        paragraphs: [
          `Users can control cookies through browser settings.`,
        ],
      },
    ],
  },

  prohibitedContent: {
    title: "Prohibited Content Appendix",
    lastUpdated,
    intro: [
      `This appendix lists content and conduct that are strictly prohibited on ${COMPANY_NAME}.`,
      `These restrictions apply to all users, all features, and all interaction modes, including any age-restricted or premium features.`,
    ],
    sections: [
      {
        heading: "Zero-Tolerance Prohibitions",
        paragraphs: [
          `The following is strictly prohibited and will result in immediate enforcement action.`,
        ],
        bullets: [
          `Any content involving minors.`,
          `Non-consensual or exploitative content.`,
          `Human trafficking or illegal activity.`,
          `Bestiality or incest.`,
          `Extreme violence.`,
        ],
      },
      {
        heading: "Reporting",
        paragraphs: [
          `Report violations to ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
};