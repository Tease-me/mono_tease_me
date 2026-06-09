import { AccountStatus } from "./enums";

export interface DashboardAiDataModel {
    id: string | number;
    imgUrl: string;
    username: string;
    fullName: string;
    joinedDate: string;
    accountStatus: AccountStatus;
    isSelected: boolean;
}