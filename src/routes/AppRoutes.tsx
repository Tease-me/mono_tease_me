import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import PayPalCancel from "@/ui/components/modals/payment-modal/PayPalCancel";
import PayPalReturn from "@/ui/components/modals/payment-modal/PayPalReturn";
import RelationshipDashboard from "@/ui/screens/admin/dashboard_relationship/RelationshipDashboard";
import InfluencerAudioManagerRoute from "@/ui/screens/influencer-audio-manager/InfluencerAudioManagerRoute";
import InfluencerWelcome from "@/ui/screens/landing-page/InfluencerWelcome";
import LandingPage from "@/ui/screens/landing-page/LandingPage";
import IncomeDialogStep01 from "@/ui/screens/landing-page/subscreens/IncomeDialogStep01";
import ProfileSurvey from "@/ui/screens/landing-page/subscreens/ProfileSurvey";
import ThankYouScreen from "@/ui/screens/landing-page/subscreens/ThankYouScreen";
import UpdateProfile from "@/ui/screens/register/UpdateProfile";
import ProfileSurveyForm from "@/ui/screens/survey/ProfileSurveyForm";

import { JSX, Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Paths } from "./path";
import GuestRoute from "./components/GuestRoute";
import PrivateRoute from "./components/PrivateRoute";
import SuperRoute from "./components/SuperRoute";
import { ThemeProvider } from "@/theme/ThemeProvider";
import TestProfilePage from "@/ui/screens/test/TestProfilePage";
import TestPage from "@/ui/screens/test/TestPage";

const AdminPreInfluencers = lazy(
  () => import("@/ui/screens/admin/pre-influencers/AdminPreInfluencers")
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
const VoiceCallEleven = lazy(
  () => import("@/ui/screens/messaging/VoiceCallEleven")
);
const HomeScreenSingle = lazy(() => import("@/ui/screens/home/HomeScreenSingle"));
const ChatScreen = lazy(() => import("@/ui/screens/messaging/ChatScreen"));
const CallScreen = lazy(() => import("@/ui/screens/CallScreen"));
const MJDashboard = lazy(() => import("@/mj-dashboard/ui/Dashboard"));
const CreateInfluencer = lazy(
  () => import("@/ui/screens/admin/create-influencer/CreateInfluencer")
);
const PromptEditorAdmin = lazy(
  () => import("@/ui/screens/admin/PromptEditorAdmin")
);
const HomePage = lazy(() => import("@/ui/screens/home-page/HomePage"));
const InfluencerHome = lazy(
  () => import("@/ui/screens/home-page/InfluencerHome")
);
const InfluencerHomeTrialExpired = lazy(
  () => import("@/ui/screens/home-page/InfluencerHomeTrialExpired")
);
const RecordTerms = lazy(
  () => import("@/ui/screens/survey/components/TermsConditions")
);
const IntencionInfluencerHome = lazy(
  () => import("@/ui/screens/home-page/IntencionInfluencerHome")
);

function AppRoutes() {
  const publicRoutes: { path: string; element: JSX.Element }[] = [
    { path: Paths.all, element: <HomePage /> },
    { path: Paths.influencerProfile(), element: <InfluencerProfileScreen /> },
    { path: Paths.testButtons, element: <TestPage /> },
    { path: Paths.testProfilePage, element: <TestProfilePage /> },
    { path: Paths.updateProfile, element: <UpdateProfile /> },
    { path: Paths.join, element: <LandingPage /> },
    { path: Paths.welcome, element: <InfluencerWelcome /> },
    { path: Paths.incomeDialog, element: <IncomeDialogStep01 /> },
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
    { path: Paths.mjDashboard, element: <MJDashboard /> },
    { path: Paths.admin.influencer, element: <CreateInfluencer /> },
    { path: Paths.admin.prompts, element: <PromptEditorAdmin /> },
    { path: Paths.admin.relationship, element: <RelationshipDashboard /> },
    { path: Paths.admin.preInfluencers, element: <AdminPreInfluencers /> },
  ];

  const privateRoutes: { path: string; element: JSX.Element }[] = [
    { path: Paths.voice, element: <VoiceCallEleven /> },
    { path: Paths.home, element: <HomeScreenSingle /> },
    { path: Paths.chat(), element: <ChatScreen /> },
    { path: Paths.call(), element: <CallScreen /> },
    { path: Paths.paypalReturn, element: <PayPalReturn /> },
    { path: Paths.paypalCancel, element: <PayPalCancel /> },
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
