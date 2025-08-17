import React from 'react';
import styles from "./IssueListItem.module.css"
import { IssueDataModel } from '@/mj-dashboard/data/models/IssueDataModel';
import Badge from '@/mj-dashboard/ui/components/badge/Badge';

interface IssueListItemProps {
    issue: IssueDataModel
}

const IssueListItem: React.FC<IssueListItemProps> = ({ issue }) => {
    return (
        <div className={styles["issue-list-item"]}>
            <div className={styles["right-side"]}>
                <div>
                    Tk ID: {issue.id}
                </div>
                <div>
                    {issue.submissionTime}
                </div>
            </div>
            <Badge type='danger'>{issue.status}</Badge>
        </div>
    );
};

export default IssueListItem;