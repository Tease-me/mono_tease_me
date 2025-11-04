import React, { useEffect, useMemo, useState } from 'react';
import styles from "./IssueDetailPane.module.css";
import { IssueDataModel } from '@/mj-dashboard/data/models/IssueDataModel';
import TextAreaInput from '@/ui/components/inputs/text-inputs/TextAreaInput';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';

interface IssueDetailPaneProps {
    issue?: IssueDataModel;
}

const IssueDetailPane: React.FC<IssueDetailPaneProps> = ({ issue }) => {
    const [replyDraft, setReplyDraft] = useState<string>("");

    useEffect(() => {
        setReplyDraft(issue?.reply ?? "");
    }, [issue?.id, issue?.reply]);

    const formatCopy = (value?: string): string => {
        if (!value) return "";
        return value
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const meta = useMemo(
        () => [
            { label: "Ticket Type", value: issue?.ticketType ?? "—" },
            { label: "Submission Time", value: issue?.submissionTime ?? "—" },
            { label: "User ID", value: issue?.userId ?? "—" },
            { label: "Username", value: issue?.username ?? "—" },
        ],
        [issue?.submissionTime, issue?.ticketType, issue?.userId, issue?.username],
    );

    const heading = useMemo(() => {
        const formattedTitle = formatCopy(issue?.title);
        if (formattedTitle) return formattedTitle;
        const formattedUsername = formatCopy(issue?.username);
        return formattedUsername ? `Issue ${formattedUsername}` : "Issue Details";
    }, [issue?.title, issue?.username]);

    const bodyParagraphs = useMemo(() => {
        const userMessage = formatCopy(issue?.message);
        const defaultParagraph = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.";
        const supplementalParagraph = "It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages.";

        if (userMessage) {
            return [userMessage, defaultParagraph, supplementalParagraph];
        }

        return [
            "Ticket context is unavailable. Please review the conversation log or request additional information from the user.",
            supplementalParagraph,
        ];
    }, [issue?.message]);

    if (!issue) {
        return (
            <div className={styles["placeholder"]}>
                Select a ticket to view its details.
            </div>
        );
    }

    return (
        <div className={styles["container"]}>
            <div className={styles["meta"]}>
                {meta.map(({ label, value }) => (
                    <div className={styles["meta-item"]} key={label}>
                        <span className={styles["meta-label"]}>{label}</span>
                        <span className={styles["meta-value"]}>{value}</span>
                    </div>
                ))}
            </div>

            <div className={styles["divider"]} />

            <div className={styles["issue-section"]}>
                <h2 className={styles["issue-title"]}>
                    {heading}
                </h2>
                <div className={styles["issue-body"]}>
                    {bodyParagraphs.map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                    ))}
                </div>
            </div>

            <div className={styles["reply-section"]}>
                <div className={styles["reply-label"]}>Reply</div>
                <TextAreaInput
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    placeholder="Type Message..."
                    className={styles["reply-textarea"]}
                    containerClassName={styles["reply-input"]}
                />
                <div className={styles["actions"]}>
                    <PrimaryButton text="Send" role="button" aria-label="Send reply" />
                </div>
            </div>
        </div>
    );
};

export default IssueDetailPane;
