import { AccountStatus, SubscriptionLevel } from "./enums";

export interface DashboardInfluencerModel {
    id: string | number;
    imgUrl: string;
    username: string;
    fullName: string;
    joinedDate: string;
    earnings: number;
    accountStatus: AccountStatus;
    subscriptionLevel: SubscriptionLevel;
}