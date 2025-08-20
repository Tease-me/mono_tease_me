import React, { useEffect, useState } from 'react';
import styles from "./InfluencerContent.module.css"
import { DashboardInfluencerModel } from '@/mj-dashboard/data/models/DashboardInfluencerModel';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';
import CheckBox from '@/ui/components/inputs/check-boxes/CheckBox';
import AccountStatusBadge from '../../../badge/AcountStatusBadge';
import SubscriptionLevelBadge from '../../../badge/SubscriptionLevelBadge';
import { ColumnDef, DataTable } from '../../../tables/DataTable';
import SvgPack from '@/utils/SvgPack';
interface InfluencerContentProps { }

const InfluencerContent: React.FC<InfluencerContentProps> = ({ }) => {
    const [influencers, setInfluencers] = useState<DashboardInfluencerModel[]>()

    const [sortConfig, setSortConfig] = useState<{ key: keyof DashboardInfluencerModel | string; direction: 'asc' | 'desc' } | null>(null);
    const handleSort = (columnKey: keyof DashboardInfluencerModel | string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === columnKey && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key: columnKey, direction });
        if (influencers) {
            const sorted = [...influencers].sort((a, b) => {
                const aValue = (a as any)[columnKey];
                const bValue = (b as any)[columnKey];
                if (aValue < bValue) return direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return direction === 'asc' ? 1 : -1;
                return 0;
            });
            setInfluencers(sorted);
        }
    };

    const dashbaordRepo = DashboardRepo()

    useEffect(() => {
        (async () => {
            const response = await dashbaordRepo.getAllInfluencers();
            setInfluencers(response);
        })()
    }, [])

    const columns: ColumnDef<DashboardInfluencerModel>[] = [
        {
            key: "select",
            header: "",
            width: "auto",
            cell: (r) => <CheckBox checked={r.isSelected} />,
        },
        {
            key: "id",
            header: "Influencer ID",
            width: "150px",
            sortable: true,
            align: "center"
        },
        {
            key: "username",
            header: "Username",
            cell: (r) => (
                <div className={styles["user-cell"]}>
                    <img className={styles["avatar"]} src={r.imgUrl} alt={r.fullName} />
                    <span>{r.fullName}</span>
                </div>
            ),
            sortable: true
        },
        {
            key: "joinedAt",
            header: "Join Date",
            width: "140px",
            cell: (r) => r.joinedDate,
            sortable: true
        },
        {
            key: "status",
            header: "Account Status",
            width: "160px",
            cell: (r) => <AccountStatusBadge accountStatus={r.accountStatus} />,
            sortable: true
        },
        {
            key: "level",
            header: "Level",
            width: "120px",
            cell: (r) => <SubscriptionLevelBadge subscriptionLevel={r.subscriptionLevel} />,
            sortable: true
        },
        {
            key: "action",
            header: "Action",
            width: "auto",
            cell: () => (
                <button className="icon-btn" aria-label="Actions"><SvgPack.MoreCircle /></button>
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
                onSort={handleSort}
            />
        </div>
    );
};

export default InfluencerContent;