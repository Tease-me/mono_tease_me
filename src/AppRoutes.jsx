import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import CallScreen from "./ui/screens/CallScreen";
import ChatScreen from "./ui/screens/messaging/ChatScreen";
import HomeScreen from "./ui/screens/home/HomeScreen";
import LoginScreen from "./ui/screens/LoginScreen";
import WelcomeScreen from "./ui/screens/WelcomeScreen";
import VoiceCall from "./ui/screens/messaging/VoiceCall";
import PrivateRoute from "./utils/PrivateRoute";
import VoiceCallEleven from "./ui/screens/messaging/VoiceCallEleven";
import VerifyEmail from "./ui/screens/verify-email/VerifyEmail";
import RegisterScreen from "./ui/screens/register/RegisterScreen";
import Confirmation from "./ui/screens/register/Confirmation";
import ResetPassword from "./ui/screens/forgot-password/ResetPassword";

function AppRoutes() {
  const publicRoutes = [
    ["*", <WelcomeScreen />],
    ["/:username", <WelcomeScreen />],
    ["/login", <LoginScreen />],
    ["/register", <RegisterScreen />],
    ["/register/verify", <Confirmation />],
    ["/reset-password", <ResetPassword />],
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
      <Routes>
        {publicRoutes.map(([path, element]) => <Route path={path} element={element} />)}
        {
          privateRoutes.map(([path, element]) => <Route path={path} element={<PrivateRoute>{element}</PrivateRoute>} />)
        }
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
