import { roxy } from "./agent-roxy";
import { lunaConfig } from "./agent-luna";
import { scarlett } from "./agent-scarlett";

export const agentConfig = lunaConfig;

export type AgentConfig = typeof agentConfig;
