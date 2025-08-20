import { DashboardInfluencerModel } from "@/mj-dashboard/data/models/DashboardInfluencerModel";
import dummy from "./dummy";
import { AccountStatus, SubscriptionLevel } from "@/mj-dashboard/data/models/enums";
import { getRandomEnumValue } from "@/utils/enum_utils";

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