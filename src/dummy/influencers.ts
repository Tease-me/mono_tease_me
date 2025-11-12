import { DashboardInfluencerModel } from "@/mj-dashboard/data/models/DashboardInfluencerModel";
import dummy from "./dummy";
import { AccountStatus, SubscriptionLevel } from "@/mj-dashboard/data/models/enums";
import { getRandomEnumValue } from "@/utils/enum_utils";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";

export async function makeDashboardInfluencer(gender: "female" | "male" = "female"): Promise<DashboardInfluencerModel> {
    const fullName = gender === "female"
        ? dummy.getRandomFemaleName()
        : dummy.getRandomMaleName()
    return ({
        imgUrl: await dummy.image.getRandomFemaleProfilePictures(),
        fullName: fullName,
        earnings: Math.floor(20000 + Math.random() * 40000),
        accountStatus: getRandomEnumValue(AccountStatus),
        id: dummy.generateRandomId(),
        joinedDate: dummy.formatDateDDMMYYYY(dummy.getRandomDate()),
        subscriptionLevel: getRandomEnumValue(SubscriptionLevel),
        username: dummy.makeUsername(fullName),
        isSelected: false
    })
};


export async function makeInfluencer(gender: "female" | "male" = "female"): Promise<InfluencerDataModel> {
    const fullName = gender === "female"
        ? dummy.getRandomFemaleName()
        : dummy.getRandomMaleName()
    return ({
        img: await dummy.image.getRandomFemaleProfilePictures(),
        name: fullName,
        earnings: Math.floor(20000 + Math.random() * 40000),
        id: dummy.makeUsername(fullName),
        created_at: dummy.formatDateDDMMYYYY(dummy.getRandomDate()),
        username: dummy.makeUsername(fullName),
        isSelected: false,
        prompt_template: "You are a charming conversational AI for TeaseMe.",
        elevenlabs_agent_id: dummy.generateRandomId(),
        voice_prompt: "Engage warmly, keep responses concise and playful.",
        social_connections: {
            instagram: Math.random() > 0.5,
            facebook: Math.random() > 0.5,
            onlyfans: Math.random() > 0.5,
            twitter: Math.random() > 0.5,
        },
    })
};