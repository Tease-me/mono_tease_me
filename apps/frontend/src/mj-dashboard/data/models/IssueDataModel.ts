export interface IssueDataModel {
    id: string;
    submissionTime: string;
    status: IssueStatus;
    ticketType: string;
    userId: string;
    username: string;
    title: string;
    message: string;
    reply: string;
    isSelected: boolean;
}

export enum IssueStatus {
    new,
    inReview,
    solved,
}