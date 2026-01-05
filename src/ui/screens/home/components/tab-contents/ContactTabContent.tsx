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

const ContactTabContent: React.FC<ContactTabContentProps> = ({ selectedContactId, onChatClicked }) => {
  const [search, setSearch] = useState("");
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [filteredInfluencers, setFilteredInfluencers] = useState<InfluencerDataModel[]>([]);

  useEffect(() => {
    const influencerRepo = InfluencerRepo();
    influencerRepo.getFollowedInfluencers()
      .then((influencers: InfluencerDataModel[]) => {
        setInfluencers(influencers);
      })
      .catch(() => {
        setInfluencers([]);
      })
  }, [])

  useEffect(() => {
    const filteredContacts = influencers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredInfluencers(filteredContacts)
  }, [influencers, search])


  return (
    <div>
      <TextInput
        className={styles["search-input"]}
        value={search}
        leftIcon={<SearchIcon />}
        placeholder="Search"
        onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
      />

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
                {contact.name}
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
      </div>
    </div>
  );
};

export default ContactTabContent;
