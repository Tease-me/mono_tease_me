import { Message } from '@/data/models/MessageDataModel';
import { CallMessageGroup } from './MessageBubble';
import { DisplayMessage } from './MessageList';

const isCallChannel = (message: Message) => {
    if (!message.channel) return false;
    return message.channel.toLowerCase().startsWith("call");
};

export const mergeCallMessages = (messageList: Message[]): DisplayMessage[] => {
    const merged: DisplayMessage[] = [];
    let currentCallGroup: CallMessageGroup | null = null;

    messageList.forEach((message) => {
        if (isCallChannel(message)) {
            const id = message.callId || `call-${message.id}`;
            const needsNew = !currentCallGroup || currentCallGroup.id !== id;

            if (needsNew) {
                currentCallGroup = {
                    id,
                    sender: "sent",
                    time: message.time,
                    messages: [],
                    type: "call-group",
                };
                merged.push(currentCallGroup);
            }

            currentCallGroup!.messages.push(message);
            currentCallGroup!.time = message.time;
            return;
        }

        currentCallGroup = null;
        merged.push(message);
    });

    return merged;
};
