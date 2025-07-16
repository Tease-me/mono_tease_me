import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import oliviaImage from "@/assets/image/avatar.png"
import BackgroundGradient from "../../templates/BackgroundGradient";

import CircularIconButton from "@/components/buttons/CircularIconButton";
import CallIcon from "@/assets/Call.svg?react";
import MicrophoneIcon from "@/assets/Microphone.svg?react";
import SendIcon from "@/assets/Send.svg?react";

import styles from "./ChatScreen.module.css";
import ProfileMedia from "@/components/ProfileMedia";
import clsx from "clsx";
import { Endpoints } from "@/api/urls";
import { TEASE_ME_HOST } from "@/api/env";
import TypingIndicator from "./components/TypingIndicator";
import MessageBubble from "./components/MessageBubble";
import ChatInputArea from "./components/ChatInputArea";

export interface Message {
  id: number;
  sender: "sent" | "received";
  text: string;
  time: string;
}

export interface Contact {
  conversation_id: string;
  name: string;
  img: string;
  messages: Message[];
}

const contacts: Contact[] = [
  {
    conversation_id: "1",
    name: "Olivia F.",
    img: oliviaImage,
    messages: [],
  },
];

const chatId = 'abc123'; // or generate per user/session
const personaId = 'loli'; // or "loli", "bella", etc

export default function ChatScreen() {
  const { id } = useParams();
  const ws = useRef<WebSocket | null>(null);
  const navigate = useNavigate();
  const user = contacts.find((c) => c.conversation_id === id);
  const [messages, setMessages] = useState(user?.messages || []);
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const jwtToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.nMCNZAW9ZROF5w0ry_wA3ywe-XnzgW40zeHSDdiN0h8'; // Cole aqui o token recebido no login

  useEffect(() => {
    console.log("Host Name", TEASE_ME_HOST);
    ws.current = new window.WebSocket(`${Endpoints.CHAT}/${personaId}?token=${jwtToken}`);
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
    }
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
          {/* <ProfileMedia imageSrc={user?.img} mediaType="image" size="xsmall" active className={styles["chat-avatar"]} /> */}
          <h3 className={styles["chat-user-name"]}>{user?.name}</h3>
          <div className={styles["chat-messages-container"]}>
            <div className={styles["messages"]}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {typing && <MessageBubble />}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <ChatInputArea onSendMessage={sendMessage} inputText={inputText} setInputText={setInputText} />
        </div>
      </div>
    </BackgroundGradient>
  );
}
