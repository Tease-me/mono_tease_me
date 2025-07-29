import axios from "axios";
import { Endpoints } from "../urls";

export const ChatServices = () => ({
    getChatHistory: async (chat_id: string, page: number, page_size: number) => {
        try {
            const response = await axios.get(
                Endpoints.HISTORY + `/${chat_id}?page=${page}&page_size=${page_size}`,
                {
                    headers: {
                        "ngrok-skip-browser-warning": "true"
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

})