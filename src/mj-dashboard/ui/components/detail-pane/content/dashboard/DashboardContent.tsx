import React, { useEffect, useState } from 'react';
import DashboardStatsCard from './components/cards/stats-card/DashboardStatsCard';
import DashboardListCard from './components/cards/list-card/DashboardListCard';
import { UserRepo } from '@/data/repositories/UserRepo';
import { UserDataModel } from '@/data/models/UserDataModel';
import DashboardListCardItem from './components/cards/list-card/DashboardListCardItem';

import styles from "./DashboardContent.module.css"
import DashboardBarChartCard from './components/cards/stats-card/DashboardBarChartCard';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';
import { DashboardResponse } from '@/mj-dashboard/data/models/DashboardResponse';
interface DashboardContentProps {
}

const DashboardContent: React.FC<DashboardContentProps> = ({ }) => {
    const [users, setUsers] = useState<UserDataModel[]>();
    const [dashboardData, setDashboardData] = useState<DashboardResponse>();

    const userRepo = UserRepo();
    const dashboardRepo = DashboardRepo();

    useEffect(() => {
        (async () => {
            const response: UserDataModel[] = await userRepo.getTopUserSpend()
            const dashboardDataResponse = await dashboardRepo.getDashboardData();
            setDashboardData(dashboardDataResponse);
            setUsers(response);
        })()
    }, [])

    return (
        <div className={styles["dashboard-content"]}>
            <div className={styles["stat-section"]}>
                <DashboardBarChartCard title='Earning Data' className={styles.chart} data={dashboardData?.earning_data ?? []} />
                <DashboardStatsCard title='Total Users'>{dashboardData?.total_users}</DashboardStatsCard>
                <DashboardStatsCard title='Total New Users'>{dashboardData?.total_new_users}</DashboardStatsCard>
                <DashboardStatsCard title='Total Influencers'>{dashboardData?.total_influencers}</DashboardStatsCard>
                <DashboardStatsCard title='Total Issues Reported'>{dashboardData?.total_issues_reported}</DashboardStatsCard>
                <DashboardStatsCard title='Total Chats'>{dashboardData?.total_chats}</DashboardStatsCard>
            </div>

            <div className={styles["list-section"]}>
                <DashboardListCard title='Top Influencer Earners'>
                    {users?.map((user) => <DashboardListCardItem key={user.id} title={user.name ?? ""} cost='$10' imgUrl={user.imgUrl} />)}
                </DashboardListCard>
                <DashboardListCard title='Top Users Spend'>
                    {users?.map((user) => <DashboardListCardItem key={user.id} title={user.name ?? ""} cost='$10' imgUrl={user.imgUrl} />)}
                </DashboardListCard>
            </div>
        </div>
    );
};

export default DashboardContent;