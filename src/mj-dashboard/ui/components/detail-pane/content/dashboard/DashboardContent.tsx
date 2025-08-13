import React, { useEffect, useState } from 'react';
import styles from "./DashboardContent.module.css"
import DashboardStatsCard from './components/cards/stats-card/DashboardStatsCard';
import DashboardListCard from './components/cards/list-card/DashboardListCard';
import { UserRepo } from '@/data/repositories/UserRepo';
import { UserDataModel } from '@/data/models/UserDataModel';
import DashboardListCardItem from './components/cards/list-card/DashboardListCardItem';

interface DashboardContentProps {
}

const DashboardContent: React.FC<DashboardContentProps> = ({ }) => {
    const [users, setUsers] = useState<UserDataModel[]>();

    const userRepo = UserRepo();

    useEffect(() => {
        (async () => {
            const response: UserDataModel[] = await userRepo.getTopUserSpend()
            setUsers(response);
        })()
    }, [])
    return (
        <div className={styles["dashboard-content"]}>
            <div className={styles["stat-section"]}>
                <DashboardStatsCard title='Earning Data' className={styles.chart}>Chart Section</DashboardStatsCard>
                <DashboardStatsCard title='Total Users'>123</DashboardStatsCard>
                <DashboardStatsCard title='Total New Users'>3</DashboardStatsCard>
                <DashboardStatsCard title='Total Influencers'>5</DashboardStatsCard>
                <DashboardStatsCard title='Total Issues Reported'>3</DashboardStatsCard>
                <DashboardStatsCard title='Total Chats'>150</DashboardStatsCard>
            </div>

            <div className={styles["list-section"]}>
                <DashboardListCard title='Top Influencer Earners'>
                    {users?.map((user) => <DashboardListCardItem title={user.name ?? ""} cost='$10' imgUrl={user.imgUrl} />)}
                </DashboardListCard>
                <DashboardListCard title='Top Users Spend'>
                    {users?.map((user) => <DashboardListCardItem title={user.name ?? ""} cost='$10' imgUrl={user.imgUrl} />)}
                </DashboardListCard>
            </div>
        </div>
    );
};

export default DashboardContent;