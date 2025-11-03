import React, { useMemo } from 'react';
import styles from "./InfluencerProfile.module.css";
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import SvgPack from '@/utils/SvgPack';
import galleryA from '@/assets/mock/profile-pics/0af48251-5061-4cf2-8c48-13d0ddd3c52c.png';
import galleryB from '@/assets/mock/profile-pics/0c5f1aeb-0db1-477b-9e49-3b95f655f6b2.jpg';
import galleryC from '@/assets/mock/profile-pics/a8e3d3b2-a5de-4519-a862-a2b849148677.jpg';
import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import ChatTopNav from '@/ui/components/nav/ChatTopNav';
import ProfileMedia from '@/ui/components/ProfileMedia';
import { truncateLastName } from '@/utils/StringUtils';
import IconButton from '@/ui/components/inputs/buttons/IconButton';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';

interface InfluencerProfileProps {
    influencer?: InfluencerDataModel;
}

const FALLBACK_BIO =
    "Olivia's short bio goes here. Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.";

const InfluencerProfile: React.FC<InfluencerProfileProps> = ({ influencer }) => {
    const profile = useMemo<InfluencerDataModel>(() => ({
        id: influencer?.id ?? "olivia",
        username: influencer?.username ?? "@olivia",
        name: influencer?.name ?? "Olivia F.",
        img: influencer?.img ?? galleryA,
        bio: influencer?.bio ?? FALLBACK_BIO,
    }), [influencer?.bio, influencer?.id, influencer?.img, influencer?.name, influencer?.username]);

    const firstName = useMemo(() => {
        if (!profile.name) return profile.username ?? "Influencer";
        const [first] = profile.name.split(" ");
        return first;
    }, [profile.name, profile.username]);

    const stats = useMemo(() => ([
        { label: "Age", value: "25" },
        { label: "Likes", value: "Chocolate" },
        { label: "Ethnicity", value: "American" },
        { label: "Occupation", value: "Dancer" },
        { label: "Hobbies", value: "Jogging, Reading True Crime, Dancing" },
        { label: "Personality", value: "Bright, outgoing, dedicated, courageous" },
    ]), []);

    const galleryItems = useMemo(() => {
        const unique = [profile.img, galleryA, galleryB, galleryC].filter(
            (value, index, arr) => !!value && arr.indexOf(value) === index
        ) as string[];
        return unique.slice(0, 3);
    }, [profile.img]);

    return (
        <FullWidthLayout fullWidthNav={<ChatTopNav onCallClick={() => { }} />}>
            <div className={styles["screen"]}>
                <section className={styles["detail"]}>
                    <div className={styles["profile-picture"]}>
                        <ProfileMedia videoSrc={influencer?.videoUrl} imageSrc={influencer?.img} mediaType='video' />
                        <div className={styles["name"]}>
                            <h3>{influencer && truncateLastName(influencer.name)}</h3>
                            <h3>{influencer && influencer.username}</h3>
                        </div>
                    </div>
                    <div className={styles["action-buttons"]}>
                        <div className={styles["button-group"]}>
                            <IconButton text='Chat' color='pink-glass' leftIcon={<SvgPack.ChatRound />} />
                            <NormalButton text='Like' leftIcon={<SvgPack.Heart />} />
                        </div>
                        <div className={styles["button-group"]}>
                            <NormalButton leftIcon={<SvgPack.OnlyFans />} color='black' />
                            <NormalButton leftIcon={<SvgPack.Instagram />} />
                            <NormalButton leftIcon={<SvgPack.TikTok />} />
                        </div>
                    </div>
                    <div className={styles["panel"]}>
                        <h2 className={styles["about-title"]}>{`About ${firstName}`}</h2>
                        <p className={styles["about-description"]}>{profile.bio ?? FALLBACK_BIO}</p>
                        <div className={styles["about-grid"]}>
                            {stats.map((stat) => (
                                <div key={stat.label} className={styles["about-grid__item"]}>
                                    <span className={styles["about-grid__label"]}>{stat.label}</span>
                                    <span className={styles["about-grid__value"]}>{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className={styles["gallery"]}>
                        {galleryItems.map((src, index) => (
                            <div key={index} className={styles["gallery__item"]}>
                                <img src={src} alt={`Gallery item ${index + 1}`} />
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </FullWidthLayout>
    );
};

export default InfluencerProfile;
