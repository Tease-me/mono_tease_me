import React from "react";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import { truncateLastName } from "@/utils/StringUtils";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";

import styles from "./ChatHeaderInfo.module.css";

type ChatHeaderInfoProps = {
  influencer?: InfluencerDataModel;
  isWsConnected: boolean;
  isSuperUser: boolean;
  chatId?: string;
  isClearingHistory: boolean;
  onChangeInfluencer: () => void;
  onClearHistory: () => void;
};

const ChatHeaderInfo: React.FC<ChatHeaderInfoProps> = ({
  influencer,
  isWsConnected,
  isSuperUser,
  chatId,
  isClearingHistory,
  onClearHistory,
}) => {
  return (
    <div className={styles["chat-header-info"]}>
      <div className={styles["chat-header-inner"]}>
        <div className={styles["profile-info"]}>
          <div className={styles["chat-user-name"]}>
            <h3>
              <a href={`/${influencer?.username ?? ""}`}>
                {influencer && truncateLastName(influencer?.name)}
              </a>
            </h3>
            <p>{isWsConnected ? "Connected" : "Not Connected"}</p>
          </div>
        </div>
        <div className={styles["chat-header-actions"]}>
          {isSuperUser && chatId && (
            <div className={styles["admin-actions"]}>
              <IconButton
                onClick={onClearHistory}
                color="red"
                text={isClearingHistory ? "Clearing..." : "Clear history"}
                className={styles["clear-history-button"]}
                disabled={isClearingHistory}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeaderInfo;
