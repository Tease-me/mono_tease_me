import React from "react";
import ChatInfluencerBar, { ChatInfluencerBarProps } from "./chatInfluencerBar";

const previewExamples: ChatInfluencerBarProps[] = [
  {
    name: "Olivia F.",
    statusIcon: "💬",
    middleContent: <span style={{ color: 'white', fontSize: '1.2rem' }}>X</span>,
    loveScore: -888,
    rankState: "up",
    glowVariant: "default",
  },
  {
    name: "Sophia L.",
    statusIcon: "🎤",
    middleContent: <span style={{ color: 'white', fontSize: '1.2rem' }}>Y</span>,
    loveScore: 456,
    rankState: "down",
    glowVariant: "default",
  },
  {
    name: "Emma W.",
    statusIcon: "💖",
    middleContent: <span style={{ color: 'white', fontSize: '1.2rem' }}>Z</span>,
    loveScore: 789,
    rankState: "up",
    glowVariant: "adult",
  },
];

export default function ChatInfluencerBarPreview() {
  return (
    <div style={{
      padding: '2rem',
      backgroundColor: '#1a1a1a',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      <h1 style={{
        color: 'white',
        fontSize: '2rem',
        textAlign: 'center',
        marginBottom: '1rem'
      }}>
        Chat Influencer Bar Preview
      </h1>

      <div style={{
        display: 'grid',
        gap: '1.5rem',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {previewExamples.map((props, index) => (
          <ChatInfluencerBar key={index} {...props} />
        ))}
      </div>

      <div style={{
        textAlign: 'center',
        color: '#999',
        fontSize: '0.9rem',
        marginTop: '2rem'
      }}>
        <p>This is a preview component for testing the ChatInfluencerBar component.</p>
      </div>
    </div>
  );
}