import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import Signup01 from "./screens/SignUp/Signup01";
import Signup02 from "./screens/SignUp/Signup02";
import Signup03 from "./screens/SignUp/Signup03";
import WelcomeScreen from "./screens/WelcomeScreen";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<WelcomeScreen isVideo={false} name="Olivia F." />}
        />
        <Route path="/signup" element={<Signup01 />} />
        <Route path="/signup/profile" element={<Signup02 />} />
        <Route path="/signup/success" element={<Signup03 />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/home" element={<HomeScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
