import { DashboardUserModel } from "@/mj-dashboard/data/models/DashboardUserModel";
import dummy from "./dummy";
import { AccountStatus, SubscriptionLevel } from "@/mj-dashboard/data/models/enums";
import { getRandomEnumValue } from "@/utils/enum_utils";

export async function makeDashboardUser(): Promise<DashboardUserModel> {
    const fullName = dummy.getRandomName()
    return ({
        imgUrl: await dummy.image.getRandomMaleProfilePictures(),
        fullName: fullName,
        accountStatus: getRandomEnumValue(AccountStatus),
        id: dummy.generateRandomId(),
        joinedDate: dummy.formatDateDDMMYYYY(),
        subscriptionLevel: getRandomEnumValue(SubscriptionLevel),
        username: dummy.makeUsername(fullName)
    })
};
