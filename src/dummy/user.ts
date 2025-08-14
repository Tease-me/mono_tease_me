import { DashboardUserModel } from "@/mj-dashboard/data/models/DashboardUserModel";
import dummy from "./dummy";
import { AccountStatus, SubscriptionLevel } from "@/mj-dashboard/data/models/enums";

export async function makeDashboardUser(): Promise<DashboardUserModel> {
    const fullName = dummy.getRandomName()
    return ({
        imgUrl: await dummy.image.getRandomMaleProfilePictures(),
        fullName: fullName,
        accountStatus: AccountStatus.active,
        id: dummy.generateRandomId(),
        joinedDate: dummy.getRandomDate().toString(),
        subscriptionLevel: SubscriptionLevel.basic,
        username: dummy.makeUsername(fullName)
    })
};
