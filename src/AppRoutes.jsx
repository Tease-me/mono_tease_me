import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import CallScreen from "./screens/CallScreen";
import ChatScreen from "./screens/ChatScreen";
import HomeScreen from "./screens/home/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import Signup01 from "./screens/signup/Signup01";
import Signup02 from "./screens/signup/Signup02";
import Signup03 from "./screens/signup/Signup03";
import WelcomeScreen from "./screens/WelcomeScreen";
import TestPage from "./screens/test/TestPage";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<WelcomeScreen name="Olivia 💋" />}
        />
        <Route
          path="/test"
          element={<TestPage />}
        />
        <Route path="/signup" element={<Signup01 />} />
        <Route path="/signup/profile" element={<Signup02 />} />
        <Route path="/signup/success" element={<Signup03 />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/chat/:id" element={<ChatScreen />} />
        <Route path="/call/:conversation_id" element={<CallScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
