import React from "react";

import styles from "./ChatHeaderInfo.module.css";

type ChatHeaderInfoProps = {
  isSuperUser: boolean;
  chatId?: string;
  isClearingHistory: boolean;
  onChangeInfluencer: () => void;
  onClearHistory: () => void;
};

const ChatHeaderInfo: React.FC<ChatHeaderInfoProps> = ({
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
            <p>{"ADMIN TOOLS"}</p>
          </div>
        </div>
        <div className={styles["chat-header-actions"]}>
          {isSuperUser && chatId && (
            <div className={styles["admin-actions"]}>
              <button
                type="button"
                className={styles["chat-header-toggle-button"]}
                onClick={onClearHistory}
              >
                {isClearingHistory ? "Clearing..." : "Clear history"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div >
  );
};

export default ChatHeaderInfo;
