import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import { terms } from "@/ui/screens/terms/termsContent";
import { ADULT_MODE_AVAILABLE } from "@/constants/adultModeAvailable";

import { JSX, Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes, Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { Paths } from "./path";
import GuestRoute from "./components/GuestRoute";
import PrivateRoute from "./components/PrivateRoute";
import SuperRoute from "./components/SuperRoute";
import { ThemeProvider } from "@/theme/ThemeProvider";

const PayPalCancel = lazy(
  () => import("@/ui/components/modals/payment-modal/PayPalCancel")
);
const PayPalReturn = lazy(
  () => import("@/ui/components/modals/payment-modal/PayPalReturn")
);
const DiditReturn = lazy(
  () => import("@/ui/components/modals/verification/DiditReturn")
);
const RelationshipDashboard = lazy(
  () =>
    import("@/ui/screens/admin/dashboard_relationship/RelationshipDashboard")
);
const InfluencerAudioManagerRoute = lazy(
  () => import("@/ui/screens/influencer-audio-manager/InfluencerAudioManagerRoute")
);
const JoinPage = lazy(() => import("@/ui/screens/join/JoinPage"));
const IncomeCalculatorScreen = lazy(
  () => import("@/ui/screens/join/subscreens/IncomeCalculatorScreen")
);
const ProfileSurvey = lazy(
  () => import("@/ui/screens/join/subscreens/ProfileSurvey")
);
const ThankYouScreen = lazy(
  () => import("@/ui/screens/join/subscreens/ThankYouScreen")
);
const ProfileSurveyForm = lazy(
  () => import("@/ui/screens/influencer-survey/ProfileSurveyForm")
);
const TermsPage = lazy(() => import("@/ui/screens/terms/TermsPage"));

const AdminPreInfluencers = lazy(
  () => import("@/ui/screens/admin/pre-influencers/AdminPreInfluencers")
);

const UnderageRedirectScreen = lazy(
  () => import("@/ui/screens/disclaimer/UnderageRedirectScreen")
);
const AdminPreInfluencerDetail = lazy(
  () =>
    import("@/ui/screens/admin/pre-influencers/AdminPreInfluencerDetail")
);
const AdminAnalytics = lazy(
  () => import("@/ui/screens/admin/analytics/AdminAnalytics")
);
const InfluencerProfileScreen = lazy(
  () => import("@/ui/screens/influencer-profile/InfluencerProfileScreen")
);
const LoginScreen = lazy(() => import("@/ui/screens/login/LoginScreen"));
const RegisterScreen = lazy(
  () => import("@/ui/screens/register/RegisterScreen")
);
const Confirmation = lazy(() => import("@/ui/screens/register/Confirmation"));
const ResetPassword = lazy(
  () => import("@/ui/screens/forgot-password/ResetPassword")
);
const ForgotPassword = lazy(
  () => import("@/ui/screens/forgot-password/ForgotPassword")
);
const VerifyEmail = lazy(() => import("@/ui/screens/verify-email/VerifyEmail"));
const HomeScreenSingle = lazy(() => import("@/ui/screens/home/HomeScreenSingle"));
const CreateInfluencer = lazy(
  () => import("@/ui/screens/admin/create-influencer/CreateInfluencer")
);
const AdminCharacters = lazy(
  () => import("@/ui/screens/admin/characters/AdminCharacters")
);
const PromptEditorAdmin = lazy(
  () => import("@/ui/screens/admin/PromptEditorAdmin")
);
const AdminKnowledge = lazy(
  () => import("@/ui/screens/admin/knowledge/AdminKnowledge")
);
const AdminChatHistory = lazy(
  () => import("@/ui/screens/admin/chat-history/AdminChatHistory")
);
const AdminLogs = lazy(() => import("@/ui/screens/admin/logs/AdminLogs"));
const AdultModePage = lazy(
  () => import("@/ui/screens/messaging/pages/adult-mode/AdultModePage")
);
const AdultModeComingSoon = lazy(
  () => import("@/ui/screens/messaging/pages/adult-mode/AdultModeComingSoon")
);
const LandingPage = lazy(() => import("@/ui/screens/landing-page/LandingPage"));
const InfluencerHome = lazy(
  () => import("@/ui/screens/landing-page/InfluencerHome")
);
const InfluencerHomeTrialExpired = lazy(
  () => import("@/ui/screens/landing-page/InfluencerHomeTrialExpired")
);
const RecordTerms = lazy(
  () => import("@/ui/screens/survey/components/TermsConditions")
);
const IntencionInfluencerHome = lazy(
  () => import("@/ui/screens/landing-page/IntencionInfluencerHome")
);

function AdultModeRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const influencerId = searchParams.get("influencerId");

  if (!ADULT_MODE_AVAILABLE) {
    return <AdultModeComingSoon onBackClicked={() => navigate(Paths.home)} />;
  }

  if (!influencerId) {
    return <Navigate to={Paths.home} replace />;
  }

  return (
    <AdultModePage
      influencerId={influencerId}
      influencerImageUrl={searchParams.get("img")}
      influencerName={searchParams.get("name")}
      onSubscribePressed={() => navigate(Paths.home)}
      onBackClicked={() => navigate(Paths.home)}
    />
  );
}

function AppRoutes() {
  const publicRoutes: { path: string; element: JSX.Element }[] = [
    { path: Paths.all, element: <LandingPage /> },
    { path: Paths.influencerProfile(), element: <InfluencerProfileScreen /> },
    { path: Paths.join, element: <JoinPage /> },
    { path: Paths.incomeCalculator, element: <IncomeCalculatorScreen /> },
    { path: Paths.profileSurvey, element: <ProfileSurvey /> },
    {
      path: Paths.influencerAudioManager(),
      element: <InfluencerAudioManagerRoute />,
    },
    { path: Paths.thankYou, element: <ThankYouScreen /> },
    { path: Paths.profileSurveyForm, element: <ProfileSurveyForm /> },
    { path: Paths.voiceTerms, element: <RecordTerms /> },
    { path: Paths.influencerHome, element: <InfluencerHome /> },
    {
      path: Paths.influencerHomeExpired,
      element: <InfluencerHomeTrialExpired />,
    },
    {
      path: Paths.intencionInfluencerHome,
      element: <IntencionInfluencerHome />,
    },
    { path: Paths.underage, element: <UnderageRedirectScreen /> },
    // --- Public Legal & Compliance Pages ---
    { path: Paths.legal.terms, element: <TermsPage {...terms.terms} /> },
    { path: Paths.legal.privacy, element: <TermsPage {...terms.privacy} /> },
    { path: Paths.legal.refunds, element: <TermsPage {...terms.refunds} /> },
    {
      path: Paths.legal.subscriptions,
      element: <TermsPage {...terms.subscriptions} />,
    },
    {
      path: Paths.legal.acceptableUse,
      element: <TermsPage {...terms.acceptableUse} />,
    },
    {
      path: Paths.legal.adultContent,
      element: <TermsPage {...terms.adultContent} />,
    },
    {
      path: Paths.legal.aiDisclosure,
      element: <TermsPage {...terms.aiDisclosure} />,
    },
    {
      path: Paths.legal.contentModeration,
      element: <TermsPage {...terms.contentModeration} />,
    },
    {
      path: Paths.legal.dataRetention,
      element: <TermsPage {...terms.dataRetention} />,
    },
    {
      path: Paths.legal.ageVerification,
      element: <TermsPage {...terms.ageVerification} />,
    },
    { path: Paths.legal.cookies, element: <TermsPage {...terms.cookies} /> },
    {
      path: Paths.legal.prohibitedContent,
      element: <TermsPage {...terms.prohibitedContent} />,
    },
  ];


  const guestRoutes: { path: string; element: JSX.Element }[] = [
    { path: Paths.login, element: <LoginScreen /> },
    { path: Paths.register(), element: <RegisterScreen /> },
    { path: Paths.registerVerify, element: <Confirmation /> },
    { path: Paths.resetPassword, element: <ResetPassword /> },
    { path: Paths.forgotPassword, element: <ForgotPassword /> },
    { path: Paths.verifyEmail, element: <VerifyEmail /> },
  ];

  const superRoutes: { path: string; element: JSX.Element }[] = [
    // { path: Paths.mjDashboard, element: <MJDashboard /> },
    {
      path: Paths.admin.root,
      element: <Navigate to={Paths.admin.analytics} replace />,
    },
    { path: Paths.admin.characters, element: <AdminCharacters /> },
    { path: Paths.admin.influencer, element: <CreateInfluencer /> },
    { path: Paths.admin.prompts, element: <PromptEditorAdmin /> },
    { path: Paths.admin.relationship, element: <RelationshipDashboard /> },
    {
      path: Paths.admin.preInfluencerDetail(),
      element: <AdminPreInfluencerDetail />,
    },
    { path: Paths.admin.preInfluencers, element: <AdminPreInfluencers /> },
    { path: Paths.admin.analytics, element: <AdminAnalytics /> },
    { path: Paths.admin.knowledge, element: <AdminKnowledge /> },
    { path: Paths.admin.chatHistory, element: <AdminChatHistory /> },
    { path: Paths.admin.logs, element: <AdminLogs /> },
  ];

  const privateRoutes: { path: string; element: JSX.Element }[] = [
    { path: Paths.home, element: <HomeScreenSingle /> },
    { path: Paths.adultMode, element: <AdultModeRoute /> },
    { path: Paths.paypalReturn, element: <PayPalReturn /> },
    { path: Paths.paypalCancel, element: <PayPalCancel /> },
    { path: Paths.diditReturn, element: <DiditReturn /> },
  ];

  return (
    <ThemeProvider initial="default">
      <BrowserRouter>
        <Suspense fallback={<BlockingLoader />}>
          <Routes>
            {publicRoutes.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
            {guestRoutes.map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={<GuestRoute>{element}</GuestRoute>}
              />
            ))}
            {privateRoutes.map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={<PrivateRoute>{element}</PrivateRoute>}
              />
            ))}
            {superRoutes.map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={<SuperRoute>{element}</SuperRoute>}
              />
            ))}
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default AppRoutes;
