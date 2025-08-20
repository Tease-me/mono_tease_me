import React, { useEffect, useState } from 'react';
import styles from "./ConversationPoolContent.module.css"
import { ConversationPoolModel } from '@/mj-dashboard/data/models/ConversationPoolDataModel';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';
import { ColumnDef, DataTable } from '../../../tables/DataTable';
import CheckBox from '@/ui/components/inputs/check-boxes/CheckBox';
import SvgPack from '@/utils/SvgPack';

interface ConversationPoolContentProps {
}

const ConversationPoolContent: React.FC<ConversationPoolContentProps> = ({ }) => {
    const [influencers, setInfluencers] = useState<ConversationPoolModel[]>()

    const [sortConfig, setSortConfig] = useState<{ key: keyof ConversationPoolModel | string; direction: 'asc' | 'desc' } | null>(null);
    const handleSort = (columnKey: keyof ConversationPoolModel | string) => {
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
            const response = await dashbaordRepo.getAllConversations();
            setInfluencers(response);
        })()
    }, [])

    const columns: ColumnDef<ConversationPoolModel>[] = [
        {
            key: "select",
            header: "",
            width: "auto",
            cell: (r) => <CheckBox checked={r.isSelected} />,
        },
        {
            key: "id",
            header: "Topic ID",
            width: "150px",
            sortable: true,
            align: "center"
        },
        {
            key: "subject",
            header: "Topic Subject",
            sortable: true
        },
        {
            key: "dateCreated",
            header: "Date Created",
            width: "140px",
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

export default ConversationPoolContent;