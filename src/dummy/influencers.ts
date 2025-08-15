import { DashboardInfluencerModel } from "@/mj-dashboard/data/models/DashboardInfluencerModel";
import dummy from "./dummy";
import { AccountStatus, SubscriptionLevel } from "@/mj-dashboard/data/models/enums";

export async function makeDashboardInfluencer(gender: "female" | "male" = "female"): Promise<DashboardInfluencerModel> {
    const fullName = gender === "female"
        ? dummy.getRandomFemaleName()
        : dummy.getRandomMaleName()
    return ({
        imgUrl: await dummy.image.getRandomFemaleProfilePictures(),
        fullName: fullName,
        earnings: Math.floor(20000 + Math.random() * 40000),
        accountStatus: AccountStatus.active,
        id: dummy.generateRandomId(),
        joinedDate: dummy.formatDateDDMMYYYY(),
        subscriptionLevel: SubscriptionLevel.basic,
        username: dummy.makeUsername(fullName),
        isSelected: false
    })
};