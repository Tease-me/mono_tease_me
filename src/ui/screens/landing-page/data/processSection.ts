import {
  default as step1Thumb,
  default as step2Thumb,
  default as step3Thumb,
  default as step4Thumb,
} from "@/assets/image/process_steps.png";

export type ProcessStep = {
  id: number;
  stepLabel: string;
  title: string;
  description: string;
  thumb: string;
};

export const PROCESS_STEPS: ProcessStep[] = [
  {
    id: 1,
    stepLabel: "STEP 1",
    title: "Get to know you",
    description:
      "Interview & questionnaire to understand your personality, likes, dislikes, and boundaries — the foundation of your AI persona.",
    thumb: step1Thumb,
  },
  {
    id: 2,
    stepLabel: "STEP 2",
    title: "Design your persona",
    description:
      "We co-create your persona’s voice, style, and fan experience so it feels like you — just amplified and always on.",
    thumb: step2Thumb,
  },
  {
    id: 3,
    stepLabel: "STEP 3",
    title: "Train & test",
    description:
      "Your AI persona is trained, tested, and refined with real conversation flows until it’s ready to meet your fans.",
    thumb: step3Thumb,
  },
  {
    id: 4,
    stepLabel: "STEP 4",
    title: "Launch & scale",
    description:
      "We plug your persona into your socials and funnels, monitor performance, and help you scale the passive income side.",
    thumb: step4Thumb,
  },
];
