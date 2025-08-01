import React, { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import PrivateRoute from "./utils/PrivateRoute";

const WelcomeScreen = lazy(() => import("./ui/screens/WelcomeScreen"));
const LoginScreen = lazy(() => import("./ui/screens/login/LoginScreen"));
const RegisterScreen = lazy(() => import("./ui/screens/register/RegisterScreen"));
const Confirmation = lazy(() => import("./ui/screens/register/Confirmation"));
const ResetPassword = lazy(() => import("./ui/screens/forgot-password/ResetPassword"));
const ForgotPassword = lazy(() => import("./ui/screens/forgot-password/ForgotPassword"));
const VerifyEmail = lazy(() => import("./ui/screens/verify-email/VerifyEmail"));
const VoiceCall = lazy(() => import("./ui/screens/messaging/VoiceCall"));
const VoiceCallEleven = lazy(() => import("./ui/screens/messaging/VoiceCallEleven"));
const HomeScreen = lazy(() => import("./ui/screens/home/HomeScreen"));
const ChatScreen = lazy(() => import("./ui/screens/messaging/ChatScreen"));
const CallScreen = lazy(() => import("./ui/screens/CallScreen"));

function AppRoutes() {
  const publicRoutes = [
    ["*", <WelcomeScreen />],
    ["/:username", <WelcomeScreen />],
    ["/login", <LoginScreen />],
    ["/register", <RegisterScreen />],
    ["/register/verify", <Confirmation />],
    ["/reset-password", <ResetPassword />],
    ["/forgot-password", <ForgotPassword />],
    ["/verify-email", <VerifyEmail />],
  ];

  const privateRoutes = [
    ["/voice", <VoiceCall />],
    ["/voice11", <VoiceCallEleven />],
    ["/home", <HomeScreen />],
    ["/chat/:user_id", <ChatScreen />],
    ["/call/:conversation_id", <CallScreen />],
  ];

  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          {publicRoutes.map(([path, element]) => (
            <Route key={path} path={path} element={element} />
          ))}
          {privateRoutes.map(([path, element]) => (
            <Route key={path} path={path} element={<PrivateRoute>{element}</PrivateRoute>} />
          ))}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
