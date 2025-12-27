import { apiClient } from "@/api/apis";
import SearchIcon from "@/assets/svg/Search.svg?react";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import clsx from "clsx";
import React, { useEffect, useMemo, useState } from "react";
import styles from "./ContactTabContent.module.css";

interface ContactTabContentProps {
  selectedContactId?: string;
  onChatClicked?: (contact: InfluencerDataModel) => void;
}

const ContactTabContent: React.FC<ContactTabContentProps> = ({
  selectedContactId,
  onChatClicked,
}) => {
  const [search, setSearch] = useState("");

  const [influencers, setInfluencers] = useState<any[]>([]);
  const [userFpRefId, setUserFpRefId] = useState<string | null | undefined>(
    undefined
  ); // undefined=loading, null=no ref, string=has ref

  // 1) Load user fp_ref_id
  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get("/auth/me");
        setUserFpRefId(data?.fp_ref_id ?? null);
      } catch {
        setUserFpRefId(null);
      }
    })();
  }, []);

  // 2) Load influencers (raw)
  useEffect(() => {
    const influencerRepo = InfluencerRepo();
    influencerRepo.getInfluencers().then((list: any[]) => {
      setInfluencers(list || []);
    });
  }, []);

  // 3) Filter by fp_ref_id + search
  const filteredInfluencers = useMemo(() => {
    if (userFpRefId === undefined) return [];

    const allowed = userFpRefId
      ? influencers.filter((inf) => inf.fp_ref_id === userFpRefId)
      : [];

    const q = search.trim().toLowerCase();
    if (!q) return allowed;

    return allowed.filter((c) =>
      (c.name || c.display_name || c.username || c.id || "")
        .toLowerCase()
        .includes(q)
    );
  }, [influencers, userFpRefId, search]);

  return (
    <div>
      <TextInput
        className={styles["search-input"]}
        value={search}
        leftIcon={<SearchIcon />}
        placeholder="Search"
        onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
      />

      {/* DEBUG / STATUS MESSAGES */}
      {userFpRefId === undefined && (
        <div style={{ padding: 12, opacity: 0.7 }}>Loading user...</div>
      )}

      {userFpRefId === null && (
        <div style={{ padding: 12, opacity: 0.7 }}>
          Your account has no <b>fp_ref_id</b> yet. (Not linked to an
          influencer)
        </div>
      )}

      {userFpRefId && (
        <div style={{ padding: "8px 12px", opacity: 0.7, fontSize: 12 }}>
          Showing influencers for fp_ref_id: <b>{userFpRefId}</b>
        </div>
      )}

      <div className={styles["vertical-scroll"]}>
        {filteredInfluencers.map((contact) => (
          <div
            key={contact.id}
            className={clsx(
              styles["contact-card"],
              contact.id === selectedContactId && styles["highlight"]
            )}
            onClick={() => onChatClicked?.(contact)}
          >
            <img src={contact.img} alt={contact.name} />
            <div style={{ minWidth: 0 }}>
              <h4 style={{ margin: 0 }}>
                {contact.name || contact.display_name}
              </h4>
              <p style={{ margin: "4px 0", opacity: 0.8 }}>
                {contact.username || contact.id}
              </p>
              <p style={{ margin: 0, opacity: 0.6, fontSize: 12 }}>
                fp_ref_id: {contact.fp_ref_id || "-"}
              </p>
            </div>
            <PrimaryButton text="Trial 14:00s" />
          </div>
        ))}

        {/* empty state */}
        {userFpRefId && filteredInfluencers.length === 0 && (
          <div style={{ padding: 12, opacity: 0.7 }}>
            No influencers matched your fp_ref_id (<b>{userFpRefId}</b>).
            <br />
            That usually means your <code>/influencer</code> list is not
            returning
            <code> fp_ref_id</code> for each influencer.
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactTabContent;
