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
import { PATHS } from "./path";
import GuestRoute from "./components/GuestRoute";
import PrivateRoute from "./components/PrivateRoute";
import SuperRoute from "./components/SuperRoute";

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
const UserProfile = lazy(() => import("@/ui/screens/user-profile/UserProfile"));
const MJDashboard = lazy(() => import("@/mj-dashboard/ui/Dashboard"));
const ButtonsTestPage = lazy(() => import("@/ui/screens/test/ButtonsTestPage"));
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
    { path: PATHS.catchAll, element: <HomePage /> },
    { path: PATHS.influencerProfile(), element: <InfluencerProfileScreen /> },
    { path: PATHS.testButtons, element: <ButtonsTestPage /> },
    { path: PATHS.updateProfile, element: <UpdateProfile /> },
    { path: PATHS.join, element: <LandingPage /> },
    { path: PATHS.welcome, element: <InfluencerWelcome /> },
    { path: PATHS.incomeDialog, element: <IncomeDialogStep01 /> },
    { path: PATHS.profileSurvey, element: <ProfileSurvey /> },
    {
      path: "/influencer/:id/audio-manager",
      element: <InfluencerAudioManagerRoute />,
    },

    { path: PATHS.thankYou, element: <ThankYouScreen /> },
    { path: PATHS.profileSurveyForm, element: <ProfileSurveyForm /> },
    { path: PATHS.voiceTerms, element: <RecordTerms /> },
    { path: PATHS.influencerHome, element: <InfluencerHome /> },
    {
      path: PATHS.influencerHomeExpired,
      element: <InfluencerHomeTrialExpired />,
    },
    {
      path: PATHS.intencionInfluencerHome,
      element: <IntencionInfluencerHome />,
    },
  ];

  const guestRoutes: { path: string; element: JSX.Element }[] = [
    { path: PATHS.login, element: <LoginScreen /> },
    { path: PATHS.register(), element: <RegisterScreen /> },
    { path: PATHS.registerVerify, element: <Confirmation /> },
    { path: PATHS.resetPassword, element: <ResetPassword /> },
    { path: PATHS.forgotPassword, element: <ForgotPassword /> },
    { path: PATHS.verifyEmail, element: <VerifyEmail /> },
  ];

  const superRoutes: { path: string; element: JSX.Element }[] = [
    { path: PATHS.mjDashboard, element: <MJDashboard /> },
    { path: PATHS.admin.influencer, element: <CreateInfluencer /> },
    { path: PATHS.admin.prompts, element: <PromptEditorAdmin /> },
    { path: PATHS.admin.relationship, element: <RelationshipDashboard /> },
    { path: PATHS.admin.preInfluencers, element: <AdminPreInfluencers /> },
  ];

  const privateRoutes: { path: string; element: JSX.Element }[] = [
    { path: PATHS.voice, element: <VoiceCallEleven /> },
    { path: PATHS.home, element: <HomeScreenSingle /> },
    { path: PATHS.profile, element: <UserProfile /> },
    { path: PATHS.chat(), element: <ChatScreen /> },
    { path: PATHS.call(), element: <CallScreen /> },
    { path: PATHS.paypalReturn, element: <PayPalReturn /> },
    { path: PATHS.paypalCancel, element: <PayPalCancel /> },
  ];

  return (
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
  );
}

export default AppRoutes;
