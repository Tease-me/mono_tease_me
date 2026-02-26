import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import PayPalCancel from "@/ui/components/modals/payment-modal/PayPalCancel";
import PayPalReturn from "@/ui/components/modals/payment-modal/PayPalReturn";
import DiditReturn from "@/ui/components/modals/verification/DiditReturn";
import RelationshipDashboard from "@/ui/screens/admin/dashboard_relationship/RelationshipDashboard";
import InfluencerAudioManagerRoute from "@/ui/screens/influencer-audio-manager/InfluencerAudioManagerRoute";
import JoinPage from "@/ui/screens/join/JoinPage";
import IncomeCalculatorScreen from "@/ui/screens/join/subscreens/IncomeCalculatorScreen";
import ProfileSurvey from "@/ui/screens/join/subscreens/ProfileSurvey";
import ThankYouScreen from "@/ui/screens/join/subscreens/ThankYouScreen";
import UpdateProfile from "@/ui/screens/register/UpdateProfile";
import ProfileSurveyForm from "@/ui/screens/influencer-survey/ProfileSurveyForm";
import TermsPage from "@/ui/screens/terms/TermsPage";
import { terms } from "@/ui/screens/terms/termsContent";

import { JSX, Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes, Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { Paths } from "./path";
import GuestRoute from "./components/GuestRoute";
import PrivateRoute from "./components/PrivateRoute";
import SuperRoute from "./components/SuperRoute";
import { ThemeProvider } from "@/theme/ThemeProvider";

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
    { path: Paths.updateProfile, element: <UpdateProfile /> },
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
    { path: "/terms", element: <TermsPage {...terms.terms} /> },
    { path: "/privacy", element: <TermsPage {...terms.privacy} /> },
    { path: "/refunds", element: <TermsPage {...terms.refunds} /> },
    { path: "/subscriptions", element: <TermsPage {...terms.subscriptions} /> },
    { path: "/acceptable-use", element: <TermsPage {...terms.acceptableUse} /> },
    { path: "/adult-content", element: <TermsPage {...terms.adultContent} /> },
    { path: "/ai-disclosure", element: <TermsPage {...terms.aiDisclosure} /> },
    { path: "/content-moderation", element: <TermsPage {...terms.contentModeration} /> },
    { path: "/data-retention", element: <TermsPage {...terms.dataRetention} /> },
    { path: "/age-verification", element: <TermsPage {...terms.ageVerification} /> },
    { path: "/cookies", element: <TermsPage {...terms.cookies} /> },
    { path: "/prohibited-content", element: <TermsPage {...terms.prohibitedContent} /> },
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
    { path: Paths.admin.influencer, element: <CreateInfluencer /> },
    { path: Paths.admin.prompts, element: <PromptEditorAdmin /> },
    { path: Paths.admin.relationship, element: <RelationshipDashboard /> },
    {
      path: Paths.admin.preInfluencerDetail(),
      element: <AdminPreInfluencerDetail />,
    },
    { path: Paths.admin.preInfluencers, element: <AdminPreInfluencers /> },
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
