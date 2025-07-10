import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import avatar from "../assets/image/avatar.png";
import BackgroundGradient from "../components/BackgroundGradient";
import styles from "./ChatScreen.module.css";

const contacts = [
  {
    conversation_id: "1",
    name: "Olivia F.",
    img: avatar,
    messages: [
      {
        id: 1,
        sender: "received",
        text: "Hi Max, good morning.. 😊😊",
        time: "10:01",
      },
      {
        id: 2,
        sender: "received",
        text: "Thanks for messaging me. How are you going? 😍😍😍",
        time: "10:01",
      },
      {
        id: 3,
        sender: "sent",
        text: "Hi, Olivia what are you wearing?",
        time: "10:02",
      },
      {
        id: 4,
        sender: "received",
        text: "Not much, but I'd like it better if I help you guess.",
        time: "10:02",
      },
      { id: 5, sender: "sent", text: "Hey there beautiful", time: "10:02" },
    ],
  },
];

export default function ChatScreen() {
  const { conversation_id } = useParams();
  const navigate = useNavigate();
  const user = contacts.find((c) => c.conversation_id === conversation_id);

  const [messages, setMessages] = useState(user?.messages || []);
  const [inputText, setInputText] = useState("");

  const sendMessage = () => {
    if (inputText.trim()) {
      setMessages([
        ...messages,
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
    <div className={styles["chat-container"]}>
      <BackgroundGradient />
      <div className={styles["chat-content"]}>
        <header className={styles["chat-header"]}>
          <button className={styles["back-btn"]} onClick={() => navigate("/home")}>
            ←
          </button>
          <h2>Inbox</h2>
          <button className={styles["menu-button"]}>⋯</button>
        </header>

        <div className={styles["chat-messages-container"]}>
          <img src={user?.img} alt={user?.name} className={styles["chat-avatar"]} />
          <h3 className={styles["chat-user-name"]}>{user?.name}</h3>

          <div className={styles["messages"]}>
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.sender}`}>
                {msg.text}
                <span className={styles["time"]}>{msg.time}</span>
              </div>
            ))}
          </div>

          <div className={styles["chat-input-area"]}>
            <input
              type="text"
              placeholder="Message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button className={styles["voice-btn"]}>🎙️</button>
            <button className={styles["send-btn"]} onClick={sendMessage}>
              ➤
            </button>
            <button
              className={styles["call-btn"]}
              onClick={() => navigate(`/call/${conversation_id}`)}
            >
              📞 Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
