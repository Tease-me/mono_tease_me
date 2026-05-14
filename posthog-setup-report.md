<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the TeaseMe React/Vite application. Here is a summary of all changes made:

- **`src/main.tsx`** — Initialised `posthog-js` with environment variables, wrapped the app in `PostHogProvider` and `PostHogErrorBoundary` for automatic error tracking and React context access throughout the component tree.
- **`src/context/AuthContext.tsx`** — Added `posthog.identify()` on successful login to link the authenticated user's email to their PostHog identity, and added `user_logged_in` / `user_logged_out` capture calls. `posthog.reset()` is called on logout to clear the session.
- **`src/ui/screens/forgot-password/ForgotPassword.tsx`** — Added `password_reset_requested` event when the user successfully submits the forgot-password form.
- **`src/ui/screens/messaging/components/ChatInputArea.tsx`** — Added `message_sent` event (with `message_type: text|audio` property) when the user sends a chat message.
- **`src/ui/screens/messaging/pages/call-page/CallModePage.tsx`** — Added `call_started` and `call_ended` events with `influencer_id` and `influencer_name` properties.
- **`src/ui/screens/messaging/pages/adult-mode/AdultModePage.tsx`** — Added `adult_mode_subscribe_clicked` event with plan price and influencer properties when the user taps the subscribe button.
- **`src/hooks/messaging/useSubscriptionState.ts`** — Added `subscription_started` (on successful subscription) and `adult_mode_enabled` (when adult mode is successfully activated) events.
- **`src/ui/components/modals/payment-modal/TopUpModal.tsx`** — Added `top_up_checkout_initiated` event with amount and provider details when the user is redirected to the payment page.
- **`src/ui/components/modals/payment-modal/ArmloopReturn.tsx`** — Added `top_up_completed` (on successful return) and `top_up_failed` (on missing session params) events.
- **`src/ui/screens/landing-page/LandingPage.tsx`** — Added `influencer_searched` event when the user clicks the Search button.
- **`.env`** — Added `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` environment variables.
- **`package.json`** — Added `posthog-js` and `@posthog/react` as dependencies.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `user_logged_in` | User successfully authenticates with email and password | `src/context/AuthContext.tsx` |
| `user_logged_out` | User logs out of the application | `src/context/AuthContext.tsx` |
| `password_reset_requested` | User submits the forgot password form successfully | `src/ui/screens/forgot-password/ForgotPassword.tsx` |
| `message_sent` | User sends a chat message (text or audio) to an influencer | `src/ui/screens/messaging/components/ChatInputArea.tsx` |
| `call_started` | User initiates a voice call with an influencer | `src/ui/screens/messaging/pages/call-page/CallModePage.tsx` |
| `call_ended` | User ends a voice call with an influencer | `src/ui/screens/messaging/pages/call-page/CallModePage.tsx` |
| `adult_mode_subscribe_clicked` | User clicks the subscribe button on the Adult Mode upsell page | `src/ui/screens/messaging/pages/adult-mode/AdultModePage.tsx` |
| `subscription_started` | User successfully starts a recurring influencer subscription | `src/hooks/messaging/useSubscriptionState.ts` |
| `adult_mode_enabled` | User successfully enables adult mode for an influencer | `src/hooks/messaging/useSubscriptionState.ts` |
| `top_up_checkout_initiated` | User initiates a credit top-up checkout and is redirected to payment provider | `src/ui/components/modals/payment-modal/TopUpModal.tsx` |
| `top_up_completed` | User returns from payment provider after a successful credit top-up | `src/ui/components/modals/payment-modal/ArmloopReturn.tsx` |
| `top_up_failed` | Credit top-up returns with an error or missing parameters | `src/ui/components/modals/payment-modal/ArmloopReturn.tsx` |
| `influencer_searched` | User clicks the Search button on the landing page to find an influencer | `src/ui/screens/landing-page/LandingPage.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1581963)
- [Daily Logins](/insights/T5w11EkL) — Tracks login volume over time to monitor user activity
- [Messages Sent per Day](/insights/p6MAY5Uf) — Tracks chat engagement over time
- [Credit Top-Up Conversion Funnel](/insights/8ws6vQLt) — Shows checkout-to-completion rate for credit purchases
- [Adult Mode Subscription Funnel](/insights/j6WSSIn1) — Shows subscribe-click-to-confirmed-subscription conversion rate
- [Voice Calls Started per Day](/insights/9dTD6Qbi) — Tracks voice call engagement over time

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
