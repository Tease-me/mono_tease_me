import React, { ReactNode } from 'react';
import clsx from 'clsx';
import styles from "./IssueListItem.module.css";
import { IssueDataModel, IssueStatus } from '@/mj-dashboard/data/models/IssueDataModel';
import Badge, { BadgeType } from '@/mj-dashboard/ui/components/badge/Badge';
import SvgPack from '@/utils/SvgPack';

interface IssueStatusMeta {
    label: string;
    badgeType: BadgeType;
    icon: ReactNode;
    tone: string;
}

const STATUS_META: Record<IssueStatus, IssueStatusMeta> = {
    [IssueStatus.new]: {
        label: "New",
        badgeType: "neutral",
        icon: <SvgPack.Star />,
        tone: "new",
    },
    [IssueStatus.inReview]: {
        label: "In Review",
        badgeType: "warning",
        icon: <SvgPack.DangerTriangleSmall />,
        tone: "in-review",
    },
    [IssueStatus.solved]: {
        label: "Solved",
        badgeType: "success",
        icon: <SvgPack.TickSquare />,
        tone: "solved",
    },
};

interface IssueListItemProps {
    issue: IssueDataModel
}

const IssueListItem: React.FC<IssueListItemProps> = ({ issue }) => {
    const status = STATUS_META[issue.status] ?? STATUS_META[IssueStatus.new];
    const ticketId = issue.id?.toUpperCase() ?? "";

    return (
        <div
            className={clsx(
                styles["issue-list-item"],
                issue.isSelected && styles["issue-list-item--selected"],
            )}
        >
            <div className={styles["issue-list-item__info"]}>
                <div className={styles["issue-list-item__ticket"]}>Tk ID: {ticketId}</div>
                <div className={styles["issue-list-item__meta"]}>{issue.submissionTime}</div>
            </div>
            <Badge
                type={status.badgeType}
                className={clsx(
                    styles["status-badge"],
                    styles[`status-badge--${status.tone}`],
                )}
            >
                <span className={styles["status-badge__icon"]}>{status.icon}</span>
                {status.label}
            </Badge>
        </div>
    );
};

export default IssueListItem;
