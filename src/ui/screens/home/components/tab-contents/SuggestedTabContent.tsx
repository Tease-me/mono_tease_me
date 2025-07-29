import React from 'react';
import styles from "./SiggestedTabContent.module.css"
import { contacts } from '@/data/mock/contacts';
import clsx from 'clsx';

interface SiggestedTabContentProps {
}

const SiggestedTabContent: React.FC<SiggestedTabContentProps> = ({ }) => {
    return (
        <>
            <div className={clsx(styles["suggested-images"], styles["horizontal-scroll"])}>
                {contacts.slice(0, 5).map((contact) => (
                    <img key={contact.id} src={contact.img} alt={contact.name} />
                ))}
            </div>

            <div className={styles["vertical-scroll"]}>
                {contacts.map((contact) => (
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