import React, { useEffect, useState } from 'react';
import styles from "./IssueReportContent.module.css";
import IssueListItem from './components/IssueListItem';
import IssueDetailPane from './components/IssueDetailPane';
import { IssueDataModel, IssueStatus } from '@/mj-dashboard/data/models/IssueDataModel';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';
import Badge, { BadgeType } from '@/mj-dashboard/ui/components/badge/Badge';

interface IssueReportContentProps {
}

const STATUS_META: Record<IssueStatus, { label: string; badgeType: BadgeType }> = {
    [IssueStatus.new]: { label: "New", badgeType: "neutral" },
    [IssueStatus.inReview]: { label: "In Review", badgeType: "warning" },
    [IssueStatus.solved]: { label: "Solved", badgeType: "success" },
};

const enhanceIssues = (response: IssueDataModel[]): IssueDataModel[] => {
    if (!response.length) return response;
    const firstId = response[0].id;
    return response.map((issue) => ({
        ...issue,
        isSelected: issue.id === firstId,
    }));
};

const IssueReportContent: React.FC<IssueReportContentProps> = ({ }) => {
    const [issues, setIssues] = useState<IssueDataModel[]>();
    const [selectedIssue, setSelectedIssue] = useState<IssueDataModel | undefined>();

    useEffect(() => {
        (async () => {
            const response = await DashboardRepo().getAllIssues();
            const enhanced = enhanceIssues(response);
            setIssues(enhanced);
            setSelectedIssue(enhanced[0]);
        })();
    }, []);

    const handleSelectIssue = (issue: IssueDataModel) => {
        setIssues((prev) => {
            if (!prev) return prev;
            const updated = prev.map((item) => ({
                ...item,
                isSelected: item.id === issue.id,
            }));
            const active = updated.find((item) => item.id === issue.id) ?? {
                ...issue,
                isSelected: true,
            };
            setSelectedIssue(active);
            return updated;
        });
    };

    const ticketId = selectedIssue?.id?.toUpperCase() ?? "—";
    const status = selectedIssue
        ? STATUS_META[selectedIssue.status] ?? STATUS_META[IssueStatus.new]
        : undefined;

    return (
        <div className={styles["issue-report-content"]}>
            <div className={styles["sidebar-pane"]}>
                <div className={styles["header"]}>
                    <div>Created</div>
                    <div>Status</div>
                </div>
                <div className={styles["body"]}>
                    {issues?.map((issue) => (
                        <IssueListItem
                            key={issue.id}
                            issue={issue}
                            onSelect={handleSelectIssue}
                        />
                    ))}
                </div>
            </div>
            <div className={styles["content-pane"]}>
                <div className={styles["header"]}>
                    <div>Ticket ID: {ticketId}</div>
                    {status && (
                        <Badge type={status.badgeType}>
                            {status.label}
                        </Badge>
                    )}
                </div>
                <div className={styles["body"]}>
                    <IssueDetailPane issue={selectedIssue} />
                </div>
            </div>
        </div>
    );
};

export default IssueReportContent;
