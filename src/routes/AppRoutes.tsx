import React, { JSX, Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import GuestRoute from "./components/GuestRoute";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";

const InfluencerProfileScreen = lazy(() => import("@/ui/screens/influencer-profile/InfluencerProfileScreen"));
const LoginScreen = lazy(() => import("@/ui/screens/login/LoginScreen"));
const RegisterScreen = lazy(() => import("@/ui/screens/register/RegisterScreen"));
const Confirmation = lazy(() => import("@/ui/screens/register/Confirmation"));
const ResetPassword = lazy(() => import("@/ui/screens/forgot-password/ResetPassword"));
const ForgotPassword = lazy(() => import("@/ui/screens/forgot-password/ForgotPassword"));
const VerifyEmail = lazy(() => import("@/ui/screens/verify-email/VerifyEmail"));
const VoiceCallEleven = lazy(() => import("@/ui/screens/messaging/VoiceCallEleven"));
const HomeScreen = lazy(() => import("@/ui/screens/home/HomeScreen"));
const ChatScreen = lazy(() => import("@/ui/screens/messaging/ChatScreen"));
const CallScreen = lazy(() => import("@/ui/screens/CallScreen"));
const UserProfile = lazy(() => import("@/ui/screens/user-profile/UserProfile"));
const MJDashboard = lazy(() => import("@/ui/screens/mj-dashboard/MJDashboard"));

function AppRoutes() {
  const publicRoutes: { path: string; element: JSX.Element }[] = [
    { path: "*", element: <InfluencerProfileScreen /> },
    { path: "/:username", element: <InfluencerProfileScreen /> },
  ];

  const guestRoutes: { path: string; element: JSX.Element }[] = [
    { path: "/mj/dashboard", element: <MJDashboard /> },
    { path: "/login", element: <LoginScreen /> },
    { path: "/register", element: <RegisterScreen /> },
    { path: "/register/verify", element: <Confirmation /> },
    { path: "/reset-password", element: <ResetPassword /> },
    { path: "/forgot-password", element: <ForgotPassword /> },
    { path: "/verify-email", element: <VerifyEmail /> },
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
            <Route key={path} path={path} element={<GuestRoute>{element}</GuestRoute>} />
          ))}
          {privateRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={<PrivateRoute>{element}</PrivateRoute>} />
          ))}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
