import React, { useState } from 'react';
import styles from "./InfluencerProfile.module.css"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import ProfileMedia from '@/ui/components/ProfileMedia';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import ButtonRow from '@/ui/templates/ButtonRow';
import { useNavigate } from 'react-router-dom';
import { truncateLastName } from '@/utils/StringUtils';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import TextAreaInput from '@/ui/components/inputs/text-inputs/TextAreaInput';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';

export interface InfluencerProfileProps {
    influencer?: InfluencerDataModel;
}

const InfluencerProfile: React.FC<InfluencerProfileProps> = ({ influencer }) => {
    const navigate = useNavigate();
    const [promptTemplate, setPromptTemplate] = useState(influencer?.prompt_template ?? "");
    const [dailyScripts, setDailyScripts] = useState<string[]>(influencer?.daily_scripts ?? []);

    const influencerRepo = InfluencerRepo();

    const addDailyScript = () => setDailyScripts((prev) => [...prev, ""]);
    const updateDailyScript = (index: number, value: string) => {
        setDailyScripts((prev) => prev.map((s, i) => (i === index ? value : s)));
    };

    const removeDailyScript = (index: number) => {
        setDailyScripts((prev) => prev.filter((_, i) => i !== index));
    };

    const handleOnUpdateClicked = () => {
        if (influencer) {
            influencerRepo.patchInfluencer(influencer, promptTemplate, dailyScripts);
        }
    }

    return (
        <BackgroundGradient>
            <FullWidthLayout fullWidthNav={<OnBoardingTopNav onBackClicked={() => { navigate(-1) }} />}>
                <div className={styles["profile-picture"]}>
                    <ProfileMedia videoSrc={influencer?.videoUrl} imageSrc={influencer?.img} mediaType='video' />
                    <div className={styles["name"]}>
                        <h3>{influencer && truncateLastName(influencer.name)}</h3>
                        <h3>{influencer && influencer.username}</h3>
                    </div>
                </div>

                <div className={styles["editor-section"]}>
                    <div className={styles["editor-group"]}>
                        <label className={styles["editor-label"]} htmlFor="promptTemplate">Prompt template</label>
                        <TextAreaInput
                            id="promptTemplate"
                            className={styles["editor-input"]}
                            value={promptTemplate}
                            onChange={(e) => setPromptTemplate(e.target.value)}
                            placeholder="Write the prompt template..."
                        />
                    </div>

                    <div className={styles["editor-group"]}>
                        <div className={styles["editor-label-row"]}>
                            <label className={styles["editor-label"]} htmlFor="dailyScripts">Daily scripts</label>
                            <button type="button" className={styles["editor-addButton"]} onClick={addDailyScript}>+ Add sentence</button>
                        </div>
                        <div className={styles["editor-array"]}>
                            {dailyScripts.map((sentence, idx) => (
                                <div className={styles["editor-line"]} key={idx}>
                                    <TextInput
                                        id={idx === 0 ? "dailyScripts" : undefined}
                                        className={styles["editor-inputLine"]}
                                        value={sentence}
                                        onChange={(e) => updateDailyScript(idx, (e.target as HTMLInputElement).value)}
                                        placeholder={`Sentence ${idx + 1}`}
                                    />
                                    <button
                                        type="button"
                                        className={styles["editor-removeButton"]}
                                        onClick={() => removeDailyScript(idx)}
                                        aria-label={`Remove sentence ${idx + 1}`}
                                        title="Remove"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <ButtonRow className={styles["button-row"]}>
                    <NormalButton text='Discard' color='black' onClick={() => navigate(-1)} />
                    <PrimaryButton text='Update' onClick={handleOnUpdateClicked} />
                </ButtonRow>
            </FullWidthLayout>
        </BackgroundGradient>

    );
};

export default InfluencerProfile;