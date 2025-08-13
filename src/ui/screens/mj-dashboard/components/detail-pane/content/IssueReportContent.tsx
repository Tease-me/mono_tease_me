import React from 'react';
import styles from "./IssueReportContent.module.css"

interface IssueReportContentProps {
}

const IssueReportContent: React.FC<IssueReportContentProps> = ({ }) => {
    return (
        <div className={styles["issue-report-conetne"]}>
            <h1>IssueReportContent</h1>
        </div>
    );
};

export default IssueReportContent;