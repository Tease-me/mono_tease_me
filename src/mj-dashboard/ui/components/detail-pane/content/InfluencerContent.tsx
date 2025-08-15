import React, { useEffect, useState } from 'react';
import styles from "./InfluencerContent.module.css"
import { ColumnDef, DataTable } from '../../tables/DataTable';
import { DashboardInfluencerModel } from '@/mj-dashboard/data/models/DashboardInfluencerModel';
import AccountStatusBadge from '../../badge/AcountStatusBadge';
import SubscriptionLevelBadge from '../../badge/SubscriptionLevelBadge';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';
import CheckBox from '@/ui/components/inputs/check-boxes/CheckBox';
interface InfluencerContentProps {
}

const InfluencerContent: React.FC<InfluencerContentProps> = ({ }) => {
    const [influencers, setInfluencers] = useState<DashboardInfluencerModel[]>()

    const dashbaordRepo = DashboardRepo()

    useEffect(() => {
        (async () => {
            const response = await dashbaordRepo.getAllInfluencers();
            setInfluencers(response);
        })()
    }, [])

    const columns: ColumnDef<DashboardInfluencerModel>[] = [
        {
            key: "id",
            header: "",
            width: "40px",
            cell: (r) => <CheckBox checked={r.isSelected} />,
        },
        {
            key: "id",
            header: "Influencer ID",
            width: "140px",
        },
        {
            key: "username",
            header: "Username",
            cell: (r) => (
                <div className="user-cell">
                    <img className="avatar" src={r.imgUrl} alt={r.fullName} />
                    <span>{r.fullName}</span>
                </div>
            ),
        },
        {
            key: "joinedAt",
            header: "Join Date",
            width: "140px",
            cell: (r) => r.joinedDate,
        },
        {
            key: "status",
            header: "Account Status",
            width: "160px",
            cell: (r) => <AccountStatusBadge accountStatus={r.accountStatus} />
        },
        {
            key: "level",
            header: "Level",
            width: "120px",
            cell: (r) => <SubscriptionLevelBadge subscriptionLevel={r.subscriptionLevel} />,
        },
        {
            key: "action",
            header: "Action",
            width: "80px",
            cell: () => (
                <button className="icon-btn" aria-label="Actions">⋮</button>
            ),
        },
    ];
    return (
        <div className={styles["influencer-content"]}>
            <DataTable
                data={influencers}
                columns={columns}
                rowKey={(r) => r.id.toString()}
                emptyState="No influencers yet"
            />
        </div>
    );
};

export default InfluencerContent;