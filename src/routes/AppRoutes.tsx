import BlockingLoader from "@/ui/components/loading/BlockingLoader";
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
import GuestRoute from "./components/GuestRoute";
import PrivateRoute from "./components/PrivateRoute";
import SuperRoute from "./components/SuperRoute";

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
const HomeScreen = lazy(() => import("@/ui/screens/home/HomeScreen"));
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
const IntencionInfluencerHome = lazy(
  () => import("@/ui/screens/home-page/IntencionInfluencerHome")
);

function AppRoutes() {
  const publicRoutes: { path: string; element: JSX.Element }[] = [
    { path: "/home-page", element: <HomePage /> },
    { path: "*", element: <InfluencerProfileScreen /> },
    { path: "/:username", element: <InfluencerProfileScreen /> },
    { path: "/test-buttons", element: <ButtonsTestPage /> },
    { path: "/update-profile", element: <UpdateProfile /> },
    { path: "/landing-page", element: <LandingPage /> },
    { path: "/welcome", element: <InfluencerWelcome /> },
    { path: "/income-dialog", element: <IncomeDialogStep01 /> },
    { path: "/profile-survey", element: <ProfileSurvey /> },
    {
      path: "/influencer/:id/audio-manager",
      element: <InfluencerAudioManagerRoute />,
    },
    { path: "/thank-you", element: <ThankYouScreen /> },
    { path: "/profile-survey-form", element: <ProfileSurveyForm /> },
    { path: "/influencer-home", element: <InfluencerHome /> },
    {
      path: "/intencion-influencer-home",
      element: <IntencionInfluencerHome />,
    },
  ];

  const guestRoutes: { path: string; element: JSX.Element }[] = [
    { path: "/login", element: <LoginScreen /> },
    { path: "/register", element: <RegisterScreen /> },
    { path: "/register/verify", element: <Confirmation /> },
    { path: "/reset-password", element: <ResetPassword /> },
    { path: "/forgot-password", element: <ForgotPassword /> },
    { path: "/verify-email", element: <VerifyEmail /> },
  ];

  const superRoutes: { path: string; element: JSX.Element }[] = [
    { path: "/mj/dashboard", element: <MJDashboard /> },
    { path: "/admin/influencer", element: <CreateInfluencer /> },
    { path: "/admin/prompts", element: <PromptEditorAdmin /> },
    { path: "/admin/relationship", element: <RelationshipDashboard /> }
  ];

  const privateRoutes: { path: string; element: JSX.Element }[] = [
    { path: "/voice", element: <VoiceCallEleven /> },
    { path: "/home", element: <HomeScreen /> },
    { path: "/chat/:user_id", element: <ChatScreen /> },
    { path: "/call/:conversation_id", element: <CallScreen /> },
    { path: "/profile", element: <UserProfile /> },
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
