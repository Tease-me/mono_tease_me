export interface DashboardUserModel {
    id: string | number;
    imgUrl: string;
    username: string;
    fullName: string;
    joinedDate: string;
    accountStatus: AccountStatus;
    subscriptionLevel: SubscriptionLevel;
}

export enum AccountStatus {
    active,
    black_list,
    frozen,
    suspended,
    inactive
}


export enum SubscriptionLevel {
    basic,
    premium,
    ultimate,
}