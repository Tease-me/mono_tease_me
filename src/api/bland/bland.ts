import logger from "@/utils/logger";
import { agentConfig } from "./config/agent-config";
import { BLAND_API_KEY, BLAND_API_URL } from "@/env";

export async function createWebAgent() {
    try {
        logger.info('Creating new web agent...');

        const response = await fetch(`${BLAND_API_URL}/v1/agents`, {
            method: 'POST',
            headers: {
                'authorization': BLAND_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(agentConfig)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Agent creation error:', errorText);
            throw new Error(`Failed to create agent: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        logger.info('Created agent:', data);
        return data;
    } catch (error) {
        logger.error('Error creating agent:', error);
        throw error;
    }
}

export async function updateWebAgent(agentId: string) {
    try {
        logger.info(`Updating agent with ID: ${agentId}`);

        const response = await fetch(`${BLAND_API_URL}/v1/agents/${agentId}`, {
            method: 'POST',
            headers: {
                'authorization': BLAND_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(agentConfig)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Agent update error:', errorText);
            throw new Error(`Failed to update agent: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        logger.info('Updated agent:', data);
        return data;
    } catch (error) {
        logger.error('Error updating agent:', error);
        throw error;
    }
}

export async function getSessionToken(agentId: string) {
    try {
        const response = await fetch(`${BLAND_API_URL}/v1/agents/${agentId}/authorize`, {
            method: 'POST',
            headers: {
                'authorization': BLAND_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API responded with status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (!data.token) {
            throw new Error("No token received");
        }

        return data.token;
    } catch (error) {
        logger.error('Error getting session token:', error);
        throw error;
    }
} 