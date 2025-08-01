import React, { JSX, Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import GuestRoute from "./GuestRoute";

const WelcomeScreen = lazy(() => import("@/ui/screens/WelcomeScreen"));
const LoginScreen = lazy(() => import("@/ui/screens/login/LoginScreen"));
const RegisterScreen = lazy(() => import("@/ui/screens/register/RegisterScreen"));
const Confirmation = lazy(() => import("@/ui/screens/register/Confirmation"));
const ResetPassword = lazy(() => import("@/ui/screens/forgot-password/ResetPassword"));
const ForgotPassword = lazy(() => import("@/ui/screens/forgot-password/ForgotPassword"));
const VerifyEmail = lazy(() => import("@/ui/screens/verify-email/VerifyEmail"));
const VoiceCall = lazy(() => import("@/ui/screens/messaging/VoiceCall"));
const VoiceCallEleven = lazy(() => import("@/ui/screens/messaging/VoiceCallEleven"));
const HomeScreen = lazy(() => import("@/ui/screens/home/HomeScreen"));
const ChatScreen = lazy(() => import("@/ui/screens/messaging/ChatScreen"));
const CallScreen = lazy(() => import("@/ui/screens/CallScreen"));

function AppRoutes() {
  const publicRoutes: { path: string; element: JSX.Element }[] = [
    { path: "/:username", element: <WelcomeScreen /> },
  ];

  const guestRoutes: { path: string; element: JSX.Element }[] = [
    { path: "*", element: <WelcomeScreen /> },
    { path: "/login", element: <LoginScreen /> },
    { path: "/register", element: <RegisterScreen /> },
    { path: "/register/verify", element: <Confirmation /> },
    { path: "/reset-password", element: <ResetPassword /> },
    { path: "/forgot-password", element: <ForgotPassword /> },
    { path: "/verify-email", element: <VerifyEmail /> },
  ];

  const privateRoutes: { path: string; element: JSX.Element }[] = [
    { path: "/voice", element: <VoiceCall /> },
    { path: "/voice11", element: <VoiceCallEleven /> },
    { path: "/home", element: <HomeScreen /> },
    { path: "/chat/:user_id", element: <ChatScreen /> },
    { path: "/call/:conversation_id", element: <CallScreen /> },
  ];

  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
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
