import React from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import HomeScreenContent from "./components/HomeScreenContent";

export default function HomeScreen() {
  return (
    <BackgroundGradient>
      <FullWidthLayout>
        <HomeScreenContent />
      </FullWidthLayout>
    </BackgroundGradient>
  );
}
