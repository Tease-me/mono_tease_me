import React, { useEffect, useState } from 'react';
import styles from "./UsersContent.module.css"
import { DashboardUserModel } from '@/mj-dashboard/data/models/DashboardUserModel';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';

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
            {users?.map(user => {
                return <p>{user.fullName}</p>
            })}
        </div>
    );
};

export default UsersContent;