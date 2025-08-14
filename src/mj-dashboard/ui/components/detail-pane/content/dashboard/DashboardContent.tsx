import React, { useEffect, useState } from 'react';
import DashboardStatsCard from './components/cards/stats-card/DashboardStatsCard';
import DashboardListCard from './components/cards/list-card/DashboardListCard';
import { UserRepo } from '@/data/repositories/UserRepo';
import { UserDataModel } from '@/data/models/UserDataModel';
import DashboardListCardItem from './components/cards/list-card/DashboardListCardItem';

import styles from "./DashboardContent.module.css"
import DashboardBarChartCard from './components/cards/stats-card/DashboardBarChartCard';
interface DashboardContentProps {
}

const DashboardContent: React.FC<DashboardContentProps> = ({ }) => {
    const [users, setUsers] = useState<UserDataModel[]>();

    const userRepo = UserRepo();
    const data = [
        { name: 'Jan', uv: 235 },
        { name: 'Feb', uv: 500 },
        { name: 'Mar', uv: 250 },
        { name: 'Apr', uv: 200 },
        { name: 'May', uv: 300 },
        { name: 'Jun', uv: 400 },
        { name: 'July', uv: 350 },
        { name: 'Aug', uv: 450 },
        { name: 'Sept', uv: 330 },
        { name: 'Oct', uv: 200 },
        { name: 'Nov', uv: 500 },
        { name: 'Dec', uv: 450 },
    ];

    useEffect(() => {
        (async () => {
            const response: UserDataModel[] = await userRepo.getTopUserSpend()
            setUsers(response);
        })()
    }, [])

    return (
        <div className={styles["dashboard-content"]}>
            <div className={styles["stat-section"]}>
                <DashboardBarChartCard title='Earning Data' className={styles.chart} data={data} />
                <DashboardStatsCard title='Total Users'>123</DashboardStatsCard>
                <DashboardStatsCard title='Total New Users'>3</DashboardStatsCard>
                <DashboardStatsCard title='Total Influencers'>5</DashboardStatsCard>
                <DashboardStatsCard title='Total Issues Reported'>3</DashboardStatsCard>
                <DashboardStatsCard title='Total Chats'>150</DashboardStatsCard>
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