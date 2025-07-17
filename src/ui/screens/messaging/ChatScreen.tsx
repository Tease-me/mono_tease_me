import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";

import styles from "./ChatScreen.module.css";
import { Endpoints } from "@/api/urls";
import { TEASE_ME_HOST } from "@/api/env";
import MessageBubble from "./components/MessageBubble";
import ChatInputArea from "./components/ChatInputArea";
import { contacts } from "@/data/mock/MockContacts";
import ProfileMedia from "@/ui/components/ProfileMedia";
import { truncateLastName } from "@/utils/StringUtils";
import { AuthContext } from "@/context/AuthContext";


const chatId = 'abc123'; // or generate per user/session
const personaId = 'loli'; // or "loli", "bella", etc

export default function ChatScreen() {
  const { id } = useParams();
  const ws = useRef<WebSocket | null>(null);
  const navigate = useNavigate();
  const user = contacts.find((c) => c.conversation_id === id);
  const [messages, setMessages] = useState(user?.messages || []);
  const [inputText, setInputText] = useState("");
  const [transcribedText, setTranscribedText] = useState("");
  const [inputAudio, setInputAudio] = useState<Blob>();
  const [typing, setTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const { accessToken } = useContext(AuthContext);

  useEffect(() => {
    ws.current = new window.WebSocket(`${Endpoints.CHAT}/${personaId}?token=${accessToken}`);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: "received",
          text: data.reply,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      setTyping(prev => !prev || false);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (inputText.trim()) {
      setTyping(prev => !prev || true);
      ws.current?.send(
        JSON.stringify({
          chat_id: chatId,
          message: inputText.trim(),
        }),
      );
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: "sent",
          text: inputText,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      setInputText("");
    } else if (inputAudio) {
      ws.current?.send(
        JSON.stringify({
          chat_id: chatId,
          message: "audio",
        })
      );
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: 'sent',
          text: "audio",
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          attachments: [
            {
              blob: inputAudio,
              type: "audio"
            }
          ]
        },
      ]);
    }
    setInputAudio(undefined);
    setInputText('');
  };

  return (
    <BackgroundGradient>
      <div className={styles["chat-container"]}>
        <div className={styles["chat-content"]}>
          <header className={styles["chat-header"]}>
            <button className={styles["back-btn"]} onClick={() => navigate("/home")}>
              ←
            </button>
            <h2>Inbox</h2>
            <button className={styles["menu-button"]}>⋯</button>
          </header>
          <ProfileMedia imageSrc={user?.img} mediaType="image" size="xsmall" active className={styles["chat-avatar"]} />
          <h3 className={styles["chat-user-name"]}>{user && truncateLastName(user?.name)}</h3>
          <div className={styles["chat-messages-container"]}>
            <div className={styles["messages"]}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {typing && <MessageBubble />}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <ChatInputArea
            onSendMessage={sendMessage}
            inputText={inputText}
            setInputText={setInputText}
            setInputAudio={setInputAudio}
            inputAudio={inputAudio}
            setTranscribedText={setTranscribedText} />
        </div>
      </div>
    </BackgroundGradient>
  );
}
