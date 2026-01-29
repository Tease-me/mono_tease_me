import React, { useEffect } from "react";

import styles from "./MessageList.module.css";
import MessageBubble, { CallMessageGroup } from "./MessageBubble";
import { Message } from "@/data/models/MessageDataModel";
import { TypingStatus } from "./ChatScreenContent";

export type DisplayMessage = Message | CallMessageGroup;

const isCallGroup = (message: DisplayMessage): message is CallMessageGroup => {
  return (message as CallMessageGroup).type === "call-group";
};

interface MessagesListProps {
  messages: DisplayMessage[];
  typing: TypingStatus;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  influencerName?: string;
  onAudioPlay?: (src: string) => void;
  showAudioTranscript?: boolean;
  isAudio?: boolean;
}

const MessagesList = React.memo(
  ({
    messages,
    typing,
    messagesEndRef,
    influencerName,
    onAudioPlay,
    showAudioTranscript,
  }: MessagesListProps) => {

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, messagesEndRef]);

    return (
      <>
        <div className={styles["messages"]}>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={!isCallGroup(msg) ? msg : undefined}
              callGroup={isCallGroup(msg) ? msg : undefined}
              influencerName={influencerName}
              onAudioPlay={onAudioPlay}
              showAudioTranscript={showAudioTranscript}
            />
          ))}

          {typing !== "idle" && <MessageBubble isAudio={typing === "recording"} />}
        </div>
        <div ref={messagesEndRef} style={{ height: "50px" }} />
      </>
    );
  }
);

export default MessagesList;
