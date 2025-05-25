import React, { useState } from "react";
import "./HomeScreen.css";

const contacts = [
  {
    id: 1,
    name: "Olivia F.",
    username: "oliviaf",
    likes: "27.3M",
    img: "../assets/image/avatar.png",
    featured: true,
  },
  {
    id: 2,
    name: "Bella Thorne",
    username: "bellathorne",
    likes: "24.5M",
    img: "./assets/image/avatar.png",
    featured: false,
  },
  {
    id: 3,
    name: "Mia Malkova",
    username: "miamalkova",
    likes: "10.1M",
    img: "./assets/image/avatar.png",
    featured: false,
  },
  {
    id: 4,
    name: "Lana Rhoades",
    username: "lanarhoades",
    likes: "16.8M",
    img: "./assets/image/avatar.png",
    featured: false,
  },
  {
    id: 5,
    name: "Sophie Dee",
    username: "sophiedee",
    likes: "9.3M",
    img: "./assets/image/avatar.png",
    featured: false,
  },
];

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState("contacts");
  const [search, setSearch] = useState("");

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="home-container">
      <div className="home-content">
        <header className="home-header">
          <h2>Good Evening Max,</h2>
          <span className="menu">⋯</span>
        </header>

        <nav className="tabs">
          <span
            className={`tab ${activeTab === "contacts" ? "active" : ""}`}
            onClick={() => setActiveTab("contacts")}
          >
            Contacts
          </span>
          <span
            className={`tab ${activeTab === "suggested" ? "active" : ""}`}
            onClick={() => setActiveTab("suggested")}
          >
            Suggested
          </span>
        </nav>

        <div className="tab-content">
          {activeTab === "contacts" ? (
            <>
              <input
                className="search-input"
                placeholder="🔍 Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {filteredContacts.map((contact) => (
                <div
                  className={`contact-card ${
                    contact.featured ? "highlight" : ""
                  }`}
                  key={contact.id}
                >
                  <img src={contact.img} alt={contact.name} />
                  <div>
                    <h4>{contact.name}</h4>
                    <p>
                      {contact.username} | {contact.likes} likes
                    </p>
                  </div>
                  <button
                    className={contact.featured ? "chat-btn" : "trial-btn"}
                  >
                    {contact.featured ? "♾️ Chat" : "Trial"}
                  </button>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="suggested-images">
                {contacts.slice(0, 3).map((contact) => (
                  <img key={contact.id} src={contact.img} alt={contact.name} />
                ))}
              </div>

              {contacts.map((contact) => (
                <div className="contact-card" key={contact.id}>
                  <img src={contact.img} alt={contact.name} />
                  <div>
                    <h4>{contact.name}</h4>
                    <p>
                      {contact.username} | {contact.likes} likes
                    </p>
                  </div>
                  <button className="trial-btn">Trial</button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
