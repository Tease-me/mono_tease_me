import step1Video from "@/assets/video/gettoknowyou-min.mp4";
import step2Video from "@/assets/video/recordvoice-min.mp4";
import step3Video from "@/assets/video/buildpersona-min.mp4";
import step4Video from "@/assets/video/monetize-min.mp4";

export type ProcessStep = {
  id: number;
  stepLabel: string;
  title: string;
  description: string;
  thumb: string; // keep the name for compatibility
};

export const PROCESS_STEPS: ProcessStep[] = [
  {
    id: 1,
    stepLabel: "STEP 1",
    title: "Get to know you",
    description:
      "Questionnaire to understand your personality, likes, dislikes, and boundaries — the foundation of your Ai persona.",
    thumb: step1Video,
  },
  {
    id: 2,
    stepLabel: "STEP 2",
    title: "Record Voice Sample",
    description:
      "Record a short voice sample in a quiet environment so we can capture the true tone, emotion, and nuances of your voice.",
    thumb: step2Video,
  },
  {
    id: 3,
    stepLabel: "STEP 3",
    title: "Persona Development",
    description:
      "Your voice and personality are combined in code and enhanced with the TeaseMe algorithm to create a natural, engaging AI persona.",
    thumb: step3Video,
  },
  {
    id: 4,
    stepLabel: "STEP 4",
    title: "Monetise your Persona",
    description:
      "Launch your Ai persona and earn passively from chats, and engagement all running automatically 24/7.",
    thumb: step4Video,
  },
];