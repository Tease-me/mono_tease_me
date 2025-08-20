import React, { useEffect, useState } from 'react';
import styles from "./IssueReportContent.module.css"
import IssueListItem from './components/IssueListItem';
import { IssueDataModel } from '@/mj-dashboard/data/models/IssueDataModel';
import { DashboardRepo } from '@/mj-dashboard/data/repositories/DashboardRepo';

interface IssueReportContentProps {
}

const IssueReportContent: React.FC<IssueReportContentProps> = ({ }) => {
    const [issues, setIssues] = useState<IssueDataModel[]>()
    const dashbaordRepo = DashboardRepo()

    useEffect(() => {
        (async () => {
            const response = await dashbaordRepo.getAllIssues();
            setIssues(response);
        })()
    }, [])
    return (
        <div className={styles["issue-report-content"]}>
            <div className={styles["sidebar-pane"]}>
                <div className={styles["header"]}>
                    <div>Created</div>
                    <div>Status</div>
                </div>
                <div className={styles["body"]}>
                    {issues?.map((issue) => <IssueListItem key={issue.id} issue={issue}></IssueListItem>)}
                </div>
            </div>
            <div className={styles["content-pane"]}>
                <div className={styles["header"]}>
                    Ticket ID: #1234
                    <div className={styles["right-side"]}>
                        Ticket Status
                    </div>
                </div>
                <div className={styles["body"]}>
                    hello
                </div>
            </div>
        </div>
    );
};

export default IssueReportContent;