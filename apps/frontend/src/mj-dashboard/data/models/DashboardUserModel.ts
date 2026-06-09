import { AccountStatus, SubscriptionLevel } from "./enums";

export interface DashboardUserModel {
    id: string | number;
    imgUrl: string;
    username: string;
    fullName: string;
    joinedDate: string;
    accountStatus: AccountStatus;
    subscriptionLevel: SubscriptionLevel;
}