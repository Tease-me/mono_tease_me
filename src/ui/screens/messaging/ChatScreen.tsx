import React from "react";
import BackgroundGradient from "../../templates/BackgroundGradient";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import ChatScreenContent from "./components/ChatScreenContent";

export default function ChatScreen() {
  return (
    <BackgroundGradient>
      <FullWidthLayout>
        <ChatScreenContent />
      </FullWidthLayout>
    </BackgroundGradient>
  );
}
