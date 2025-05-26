import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import avatar from "../../assets/image/avatar.png";
import BackgroundGradient from "../../components/BackgroundGradient";
import "./HomeScreen.css";

const contacts = [
  {
    id: 1,
    name: "Olivia F.",
    username: "oliviaf",
    likes: "27.3M",
    img: avatar,
    featured: true,
  },
  {
    id: 2,
    name: "Bella Thorne",
    username: "bellathorne",
    likes: "24.5M",
    img: avatar,
  },
  {
    id: 3,
    name: "Mia Malkova",
    username: "miamalkova",
    likes: "10.1M",
    img: avatar,
  },
  {
    id: 4,
    name: "Lana Rhoades",
    username: "lanarhoades",
    likes: "16.8M",
    img: avatar,
  },
  {
    id: 5,
    name: "Sophie Dee",
    username: "sophiedee",
    likes: "9.3M",
    img: avatar,
  },
  {
    id: 6,
    name: "Stormy Daniels",
    username: "stormydaniels",
    likes: "8.5M",
    img: avatar,
  },
];

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState("contacts");
  const [search, setSearch] = useState("");
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    const closeMenu = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  return (
    <div className="home-container">
      <BackgroundGradient />
      <div className="home-content">
        <header className="home-header">
          <h2>Good Evening Max,</h2>
          <button
            className="menu-button"
            onClick={() => setMenuOpen((prev) => !prev)}
            ref={buttonRef}
          >
            ⋯
          </button>

          {menuOpen && (
            <div className="dropdown-menu" ref={menuRef}>
              <div className="dropdown-item">
                <span>👤</span> My Profile
              </div>
              <div className="divider"></div>
              <div className="dropdown-item">
                <span>🧩</span> Subscriptions
              </div>
              <div className="divider"></div>
              <div className="dropdown-item">
                <span>⚠️</span> Support
              </div>
            </div>
          )}
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

        {activeTab === "contacts" && (
          <>
            <input
              className="search-input"
              placeholder="🔍 Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="vertical-scroll">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`contact-card ${
                    contact.featured ? "highlight" : ""
                  }`}
                  onClick={() => navigate(`/chat/${contact.id}`)}
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
            </div>
          </>
        )}

        {activeTab === "suggested" && (
          <>
            <div className="suggested-images horizontal-scroll">
              {contacts.slice(0, 5).map((contact) => (
                <img key={contact.id} src={contact.img} alt={contact.name} />
              ))}
            </div>

            <div className="vertical-scroll">
              {contacts.map((contact) => (
                <div key={contact.id} className="contact-card">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
