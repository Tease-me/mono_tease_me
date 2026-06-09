import iconChat from "@/assets/image/icon3dchat.png";
import iconChat2x from "@/assets/image/icon3dchat@2x.png";
import iconDollar from "@/assets/image/icon3ddollar.png";
import iconDollar2x from "@/assets/image/icon3ddollar@2x.png";
import iconHeart from "@/assets/image/icon3dheart.png";
import iconHeart2x from "@/assets/image/icon3dheart@2x.png";
import iconWorld from "@/assets/image/icon3dworld.png";
import iconWorld2x from "@/assets/image/icon3dworld@2x.png";

export type WhyItem = {
  id: number;
  title: string;
  description: string;
  thumb: string;
  thumb2x: string;
};

export const WHY_ITEMS: WhyItem[] = [
  {
    id: 1,
    title: "Millions of chats at the same time",
    description:
      "Your AI handles unlimited conversations in parallel, giving every fan personal attention. No queue, no burnout—your audience always gets instant replies, and your engagement numbers scale automatically.",
    thumb: iconChat,
    thumb2x: iconChat2x,
  },
  {
    id: 2,
    title: "Earn money while you travel or sleep",
    description:
      "Your TeaseMe persona keeps chatting, flirting, and converting even when you’re offline. You focus on creating, your AI persona keeps the income flowing in the background.",
    thumb: iconDollar,
    thumb2x: iconDollar2x,
  },
  {
    id: 3,
    title: "Protect your time and mental energy",
    description:
      "Say goodbye to answering DMs all day. Your AI persona filters, handles, and responds to fans—so you can work on the big moves, not the tiny messages.",
    thumb: iconHeart,
    thumb2x: iconHeart2x,
  },
  {
    id: 4,
    title: "Turn attention into predictable revenue",
    description:
      "Connect your persona to your offers, platforms, and funnels. Fans get a personalized, always-on experience—and you turn more of that attention into recurring income.",
    thumb: iconWorld,
    thumb2x: iconWorld2x,
  },
];
