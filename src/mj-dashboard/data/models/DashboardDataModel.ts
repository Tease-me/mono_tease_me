export interface DashboardDataModel {
    earning_data: EarningsData[];
    total_users: number;
    total_new_users: number;
    total_influencers: number;
    total_issues_reported: number;
    total_chats: number;
    top_influencers: any[]
    top_users: any[],
}

export interface EarningsData {
    month: string;
    earnings: number;
}