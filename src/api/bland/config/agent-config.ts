import { roxy } from "./agent-roxy";
import { lunaConfig } from "./agent-luna";
import { scarlett } from "./agent-scarlett";

export const agentConfig = roxy;

export type AgentConfig = typeof agentConfig;
