import React, { useEffect, useState } from 'react';
import styles from "./ContactTabContent.module.css"
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import InfinityIcon from "@/assets/svg/Infinity.svg?react";
import SearchIcon from "@/assets/svg/Search.svg?react";
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import clsx from 'clsx';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';

interface ContactTabContentProps {
    selectedContactId?: string;
    onChatClicked?: (contact: InfluencerDataModel) => void;
}

const ContactTabContent: React.FC<ContactTabContentProps> = ({ selectedContactId, onChatClicked }) => {
    const [search, setSearch] = useState("");
    const [influencers, setInfluencers] = useState<InfluencerDataModel[]>();
    const [filteredInfluencers, setFilteredInfluencers] = useState<InfluencerDataModel[]>();

    useEffect(() => {
        const influencerRepo = InfluencerRepo();
        influencerRepo.getInfluencers().then((influencers: InfluencerDataModel[]) => {
            setInfluencers(influencers)
        })
    }, [])

    useEffect(() => {
        if (influencers) {
            const filteredContacts = influencers.filter((c) =>
                c.name.toLowerCase().includes(search.toLowerCase())
            );
            setFilteredInfluencers(filteredContacts)
        }
    }, [influencers])


    return (
        <div>
            <TextInput className={styles["search-input"]} value={search} leftIcon={<SearchIcon />} placeholder='Search' onChange={(e) => setSearch((e.target as HTMLInputElement).value)} />
            <div className={styles["vertical-scroll"]}>
                {filteredInfluencers && filteredInfluencers.map((contact) => (
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