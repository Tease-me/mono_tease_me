import dummy from "@/dummy/dummy";
import { DashboardDataModel, EarningsData } from "../models/DashboardDataModel";
import { DashboardUserModel } from "../models/DashboardUserModel";
import { DashboardInfluencerModel } from "../models/DashboardInfluencerModel";

function generateMonthlyEarnings(): EarningsData[] {
    const monthLabels = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "July",
        "Aug",
        "Sept",
        "Oct",
        "Nov",
        "Dec",
    ];

    const base = 20000 + Math.floor(Math.random() * 15000); // 20k–35k base

    return monthLabels.map((label, i) => {
        const seasonal = Math.sin((i / 12) * Math.PI * 2) * 5000; // +/-5k wave
        const noise = Math.floor(Math.random() * 3000) - 1500;    // +/-1.5k noise
        const value = Math.max(8000, Math.round(base + seasonal + noise));
        return { month: label, earnings: value };
    });
}

export function DashboardRepo() {
    return {
        getDashboardData: async (): Promise<DashboardDataModel> => {
            const earning_data = generateMonthlyEarnings();

            const top_influencers = await Promise.all([
                dummy.influencers.makeDashboardInfluencer("female"),
                dummy.influencers.makeDashboardInfluencer("female"),
                dummy.influencers.makeDashboardInfluencer("female"),
                dummy.influencers.makeDashboardInfluencer("female"),
                dummy.influencers.makeDashboardInfluencer("female"),
            ]);

            const top_users = await Promise.all([
                dummy.users.makeDashboardUser(),
                dummy.users.makeDashboardUser(),
                dummy.users.makeDashboardUser(),
                dummy.users.makeDashboardUser(),
                dummy.users.makeDashboardUser(),
                dummy.users.makeDashboardUser(),
            ]);

            return {
                earning_data,
                total_users: 123,
                total_new_users: 3,
                total_influencers: 5,
                total_issues_reported: 3,
                total_chats: 150,
                top_influencers,
                top_users,
            };
        },
        getAllUsers: async (): Promise<DashboardUserModel[]> => {
            const count = Math.floor(Math.random() * 49) + 51;
            const tasks = Array.from({ length: count }, () =>
                dummy.users.makeDashboardUser(),
            );
            return Promise.all(tasks);
        },
        getAllInfluencers: async (): Promise<DashboardInfluencerModel[]> => {
            const count = Math.floor(Math.random() * 49) + 51;
            const tasks = Array.from({ length: count }, () =>
                dummy.influencers.makeDashboardInfluencer("female")
            );
            return Promise.all(tasks);
        }
    } as const;

}
