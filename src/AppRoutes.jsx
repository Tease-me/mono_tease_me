import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import CallScreen from "./ui/screens/CallScreen";
import ChatScreen from "./ui/screens/messaging/ChatScreen";
import HomeScreen from "./ui/screens/home/HomeScreen";
import LoginScreen from "./ui/screens/LoginScreen";
import Signup01 from "./ui/screens/signup/Signup01";
import Signup02 from "./ui/screens/signup/Signup02";
import Signup03 from "./ui/screens/signup/Signup03";
import WelcomeScreen from "./ui/screens/WelcomeScreen";
import TestPage from "./ui/screens/test/TestPage";
import VoiceCall from "./ui/screens/messaging/VoiceCall";
import PrivateRoute from "./utils/PrivateRoute";

function AppRoutes() {
  const publicRoutes = [
    ["*", <WelcomeScreen />],
    ["/:username", <WelcomeScreen />],
    ["/login", <LoginScreen />],
    ["/signup", <Signup01 />],
    ["/signup/profile", <Signup02 />],
    ["/signup/success", <Signup03 />],
    ["/test", <TestPage />],
  ];

  const privateRoutes = [
    ["/voice", <VoiceCall />],
    ["/home", <HomeScreen />],
    ["/chat/:id", <ChatScreen />],
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
