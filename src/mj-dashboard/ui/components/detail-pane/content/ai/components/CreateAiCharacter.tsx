import React, { useMemo } from 'react';
import styles from "./CreateAiCharacter.module.css";
import SvgPack from '@/utils/SvgPack';

interface CreateAiCharacterProps {
    onBack: () => void;
}

const CreateAiCharacter: React.FC<CreateAiCharacterProps> = ({ onBack }) => {
    const personalityTags = useMemo(
        () => ["Cute", "Personality", "Funny", "Shy", "Outgoing", "Sexy", "Spicy"],
        [],
    );
    const toneTags = useMemo(
        () => ["Funny", "Conversational", "Friendly", "Flirty", "Soft", "Tone", "Warm"],
        [],
    );
    const restrictedTags = useMemo(
        () => ["Keyword", "Keyword", "Keyword", "Keyword", "Keyword", "Sensitive"],
        [],
    );
    const characterResponses = useMemo(
        () => [
            { id: "res-1", userSays: "I like you", response: "I like you too" },
            { id: "res-2", userSays: "Marry me", response: "Really?" },
            { id: "res-3", userSays: "How old are you?", response: "21" },
        ],
        [],
    );
    const voiceMemos = useMemo(
        () => [
            {
                id: "memo-1",
                packId: "#1234",
                categoryType: "First Intro.",
                recordingDate: "2025/07/13 09:08 AM",
                fileSize: "1.25 Mb",
                format: "AAC",
                status: "Success",
                transcript:
                    "Dummy text for general greetings. Hello there, how's your day. Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.",
            },
            {
                id: "memo-2",
                packId: "#1234",
                categoryType: "First Intro.",
                recordingDate: "2025/07/13 09:08 AM",
                fileSize: "1.25 Mb",
                format: "AAC",
                status: "Success",
                transcript:
                    "Dummy text for general greetings. Hello there, how's your day. Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.",
            },
        ],
        [],
    );

    return (
        <div className={styles["create-ai"]}>
            <div className={styles["create-ai__header"]}>
                <button
                    type="button"
                    className={styles["back-button"]}
                    onClick={onBack}
                >
                    ← Back to Management
                </button>
                <h1 className={styles["create-ai__title"]}>Create new Ai Character</h1>
            </div>

            <div className={styles["create-ai__layout"]}>
                <aside className={styles["media-panel"]}>
                    <div className={styles["media-placeholder"]}>
                        <SvgPack.Profile />
                    </div>
                    <div className={styles["media-actions"]}>
                        <button type="button" className={styles["media-button"]}>Edit</button>
                        <button type="button" className={styles["media-button"]}>Remove</button>
                    </div>
                </aside>

                <section className={styles["form-panel"]}>
                    <div className={styles["panel"]}>
                        <div className={styles["panel-header"]}>
                            <h2 className={styles["panel-title"]}>Character Information</h2>
                            <button type="button" className={styles["panel-action"]}>Edit</button>
                        </div>
                        <div className={styles["info-grid"]}>
                            <input className={styles["input"]} placeholder="Character ID" />
                            <input className={styles["input"]} placeholder="Influencer First Name" />
                            <input className={styles["input"]} placeholder="Influencer Last Name" />
                            <input className={styles["input"]} placeholder="Created Date" type="date" />
                            <select className={`${styles["input"]} ${styles["select"]}`} defaultValue="">
                                <option value="" disabled>Status</option>
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles["panel"]}>
                        <div className={styles["panel-header"]}>
                            <h2 className={styles["panel-title"]}>Personality</h2>
                            <div className={styles["panel-actions"]}>
                                <button type="button" className={styles["panel-action"]}>Edit</button>
                                <button type="button" className={styles["panel-action"]}>+ Add New</button>
                            </div>
                        </div>
                        <div className={styles["tag-list"]}>
                            {personalityTags.map((tag) => (
                                <span key={tag} className={styles["tag"]}>{tag}</span>
                            ))}
                        </div>
                    </div>

                    <div className={styles["panel"]}>
                        <div className={styles["panel-header"]}>
                            <h2 className={styles["panel-title"]}>Tone of Voice</h2>
                            <div className={styles["panel-actions"]}>
                                <button type="button" className={styles["panel-action"]}>Edit</button>
                                <button type="button" className={styles["panel-action"]}>+ Add New</button>
                            </div>
                        </div>
                        <div className={styles["tag-list"]}>
                            {toneTags.map((tag) => (
                                <span key={tag} className={styles["tag"]}>{tag}</span>
                            ))}
                        </div>
                    </div>

                    <div className={styles["panel"]}>
                        <div className={styles["panel-header"]}>
                            <h2 className={styles["panel-title"]}>Restricted Keywords</h2>
                            <div className={styles["panel-actions"]}>
                                <button type="button" className={styles["panel-action"]}>Edit</button>
                                <button type="button" className={styles["panel-action"]}>+ Add New</button>
                            </div>
                        </div>
                        <div className={styles["tag-list"]}>
                            {restrictedTags.map((tag, index) => (
                                <span key={`${tag}-${index}`} className={styles["tag"]}>{tag}</span>
                            ))}
                        </div>
                    </div>

                    <div className={styles["panel"]}>
                        <div className={styles["panel-header"]}>
                            <h2 className={styles["panel-title"]}>Character Response</h2>
                            <div className={styles["panel-actions"]}>
                                <button type="button" className={styles["panel-action"]}>Edit</button>
                                <button type="button" className={styles["panel-action"]}>+ Add New</button>
                            </div>
                        </div>
                        <div className={styles["response-list"]}>
                            {characterResponses.map((item) => (
                                <div key={item.id} className={styles["response-item"]}>
                                    <div className={styles["response-copy"]}>
                                        <div className={styles["response-prompt"]}>
                                            <span className={styles["response-label"]}>If user says:</span>
                                            <span className={styles["response-value"]}>{item.userSays}</span>
                                        </div>
                                        <div className={styles["response-reply"]}>
                                            <span className={styles["response-label"]}>Response:</span>
                                            <span className={styles["response-value response-value--highlight"]}>{item.response}</span>
                                        </div>
                                    </div>
                                    <button type="button" className={styles["response-edit"]}>Edit</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles["panel"]}>
                        <div className={styles["panel-header"]}>
                            <h2 className={styles["panel-title"]}>Voice Memo</h2>
                            <div className={styles["panel-actions"]}>
                                <button type="button" className={styles["panel-action"]}>Edit</button>
                                <button type="button" className={styles["panel-action"]}>+ Create New</button>
                            </div>
                        </div>
                        <div className={styles["voice-memo-list"]}>
                            {voiceMemos.map((memo) => (
                                <div key={memo.id} className={styles["voice-memo"]}>
                                    <div className={styles["voice-memo__meta"]}>
                                        <span className={styles["voice-memo__label"]}>Voice Pack ID:</span>
                                        <span>{memo.packId}</span>
                                        <span className={styles["voice-memo__label"]}>Category Type</span>
                                        <span>{memo.categoryType}</span>
                                        <span className={styles["voice-memo__label"]}>Recording Date</span>
                                        <span>{memo.recordingDate}</span>
                                        <span className={styles["voice-memo__label"]}>File Size &amp; Format</span>
                                        <span>{memo.fileSize} · {memo.format}</span>
                                        <span className={styles["voice-memo__label"]}>Progress Status</span>
                                        <span className={styles["voice-memo__status"]}>{memo.status}</span>
                                    </div>
                                    <div className={styles["voice-memo__body"]}>
                                        <h3 className={styles["voice-memo__title"]}>Record Text</h3>
                                        <p className={styles["voice-memo__transcript"]}>{memo.transcript}</p>
                                        <button type="button" className={styles["voice-memo__edit"]}>Edit</button>
                                    </div>
                                    <button type="button" className={styles["voice-memo__play"]} aria-label="Play memo">
                                        <SvgPack.Voice />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <div className={styles["form-actions"]}>
                <button type="button" className={styles["action-button"]} onClick={onBack}>Cancel</button>
                <div className={styles["action-button-group"]}>
                    <button type="button" className={styles["action-button action-button--danger"]}>Delete</button>
                    <button type="button" className={styles["action-button action-button--primary"]}>Save</button>
                </div>
            </div>
        </div>
    );
};

export default CreateAiCharacter;
