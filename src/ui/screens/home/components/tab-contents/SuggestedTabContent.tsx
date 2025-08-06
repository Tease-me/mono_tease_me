import React, { useEffect, useState } from 'react';
import styles from "./SiggestedTabContent.module.css"
import { contacts } from '@/data/mock/contacts';
import clsx from 'clsx';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import LoadingSpinner from '@/ui/components/loading/LoadingSpinner';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';

interface SiggestedTabContentProps {
}

const SiggestedTabContent: React.FC<SiggestedTabContentProps> = ({ }) => {
    const [influencers, setInfluencers] = useState<InfluencerDataModel[]>();
    const influencerRepo = InfluencerRepo();
    useEffect(() => {
        (async () => {
            const influencers = await influencerRepo.getInfluencers();
            setInfluencers(influencers)
        }
        )()
    }, [])

    if (!influencers) return <LoadingSpinner />

    return (
        <>
            <div className={clsx(styles["suggested-images"], styles["horizontal-scroll"])}>
                {influencers.slice(0, 5).map((contact) => (
                    <img key={contact.id} src={contact.img} alt={contact.name} />
                ))}
            </div>

            <div className={styles["vertical-scroll"]}>
                {influencers.map((contact) => (
                    <div key={contact.id} className={styles["contact-card"]}>
                        <img src={contact.img} alt={contact.name} />
                        <div>
                            <h4>{contact.name}</h4>
                            <p>{contact.username}</p>
                        </div>
                        <button className={styles["trial-btn"]}>Trial</button>
                    </div>
                ))}
            </div>
        </>
    );
};

export default SiggestedTabContent;