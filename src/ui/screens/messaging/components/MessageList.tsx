import React from "react";

import styles from "./ChatScreenContent.module.css";
import MessageBubble, { CallMessageGroup } from "./MessageBubble";
import { Message } from "@/data/models/MessageDataModel";

export type DisplayMessage = Message | CallMessageGroup;

const isCallGroup = (message: DisplayMessage): message is CallMessageGroup => {
  return (message as CallMessageGroup).type === "call-group";
};

interface MessagesListProps {
  messages: DisplayMessage[];
  typing: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  influencerName?: string;
  onAudioPlay?: (src: string) => void;
}

const MessagesList = React.memo(
  ({
    messages,
    typing,
    messagesEndRef,
    influencerName,
    onAudioPlay,
  }: MessagesListProps) => {
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
            />
          ))}
          {typing && <MessageBubble />}
        </div>
        <div ref={messagesEndRef} style={{ height: "50px" }} />
        {messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
      </>
    );
  }
);

export default MessagesList;
