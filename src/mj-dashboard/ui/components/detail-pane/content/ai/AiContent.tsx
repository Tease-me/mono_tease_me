import React, { useEffect, useState } from 'react';
import styles from "./AiContent.module.css"
import { DashboardAiDataModel } from '@/mj-dashboard/data/models/DashboardAiDataModel';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';
import { ColumnDef, DataTable } from '../../../tables/DataTable';
import CheckBox from '@/ui/components/inputs/check-boxes/CheckBox';
import AccountStatusBadge from '../../../badge/AcountStatusBadge';
import SvgPack from '@/utils/SvgPack';

interface AiContentProps {
}

const AiContent: React.FC<AiContentProps> = ({ }) => {
    const [influencers, setInfluencers] = useState<DashboardAiDataModel[]>()

    const [sortConfig, setSortConfig] = useState<{ key: keyof DashboardAiDataModel | string; direction: 'asc' | 'desc' } | null>(null);
    const handleSort = (columnKey: keyof DashboardAiDataModel | string) => {
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
            const response = await dashbaordRepo.getAllAi();
            setInfluencers(response);
        })()
    }, [])

    const columns: ColumnDef<DashboardAiDataModel>[] = [
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
                <div className={styles["ai-cell"]}>
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

export default AiContent;