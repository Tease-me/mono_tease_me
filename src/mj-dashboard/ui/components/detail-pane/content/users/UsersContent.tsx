import React, { useEffect, useState } from 'react';
import styles from "./UsersContent.module.css"
import { DashboardUserModel } from '@/mj-dashboard/data/models/DashboardUserModel';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';
import DashboardUserListItem from './components/DashboardUserListItem';

interface UsersContentProps {
}

const UsersContent: React.FC<UsersContentProps> = ({ }) => {
    const [users, setUsers] = useState<DashboardUserModel[]>();

    const dashboardRepo = DashboardRepo();

    useEffect(() => {
        (async () => {
            const dashboardDataResponse = await dashboardRepo.getAllUsers();
            setUsers(dashboardDataResponse);
        })()
    }, [])

    return (
        <div className={styles["users-content"]}>
            <div className={styles["user-table"]}>
                {users?.map(user => {
                    return <DashboardUserListItem key={user.id} user={user} />
                })}
            </div>
        </div>
    );
};

export default UsersContent;