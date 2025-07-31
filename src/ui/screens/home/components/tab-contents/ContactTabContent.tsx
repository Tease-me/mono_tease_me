import React, { useState } from 'react';
import styles from "./ContactTabContent.module.css"
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import { contacts } from '@/data/mock/contacts';
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import InfinityIcon from "@/assets/svg/Infinity.svg?react";
import SearchIcon from "@/assets/svg/Search.svg?react";
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import clsx from 'clsx';

interface ContactTabContentProps {
    selectedContactId?: string;
    onChatClicked?: (contact: InfluencerDataModel) => void;
}

const ContactTabContent: React.FC<ContactTabContentProps> = ({ selectedContactId, onChatClicked }) => {
    const [search, setSearch] = useState("");
    const filteredContacts = contacts.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );
    return (
        <div>
            <TextInput className={styles["search-input"]} value={search} leftIcon={<SearchIcon />} placeholder='Search' onChange={(e) => setSearch((e.target as HTMLInputElement).value)} />
            <div className={styles["vertical-scroll"]}>
                {filteredContacts.map((contact) => (
                    <div
                        key={contact.id}
                        className={clsx(styles["contact-card"], contact.id === selectedContactId && styles["highlight"])}
                        onClick={() => onChatClicked?.(contact)}>
                        <img src={contact.img} alt={contact.name} />
                        <div>
                            <h4>{contact.name}</h4>
                            <p>{contact.username}</p>
                        </div>
                        <CircularIconButton icon={<InfinityIcon />} text='Chat' size='xsmall' />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContactTabContent;