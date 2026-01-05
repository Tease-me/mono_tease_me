import React, { useMemo, useState } from "react";
import ProfileMedia from "@/ui/components/ProfileMedia";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import styles from "./InfluencerSelector.module.css";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";

interface InfluencerSelectorProps {
  influencers: InfluencerDataModel[];
  onItemClick?: (id: string) => void;
}

export default function InfluencerSelector({ influencers, onItemClick }: InfluencerSelectorProps) {
  const [selected, setSelected] = useState<string | null>();

  const stage = useMemo<"idle" | "ready">(
    () => (selected ? "ready" : "idle"),
    [selected]
  );

  const handleConfirmSelection = () => {
    if (selected && onItemClick) {
      onItemClick(selected);
    }
  };

  const button =
    stage === "ready" ? (
      <PrimaryButton
        text="Confirm Selection"
        onClick={handleConfirmSelection}
        className={styles["cta"]}
      />
    ) : (
      <NormalButton
        text="Confirm Selection"
        disabled
        className={styles["cta-disabled"]}
      />
    );

  return (
    <BackgroundGradient>
      <div className={styles["shell"]}>
        <div className={styles["card"]}>
          <div className={styles["avatar-row"]}>
            {influencers && influencers.map((candidate) => {
              const isActive = candidate.id === selected;
              return (
                <button
                  key={candidate.id}
                  className={`${styles["avatar"]} ${isActive ? styles["avatar--active"] : ""
                    }`}
                  onClick={() => setSelected(candidate.id)}
                >
                  <ProfileMedia
                    size="large"
                    active={isActive}
                    showHearts={isActive}
                    mediaType="image"
                    imageSrc={candidate.img}
                  />
                  <div
                    className={`${styles["name"]} ${isActive ? styles["name--active"] : ""
                      }`}
                  >
                    {candidate.name}
                  </div>
                </button>
              );
            })}
          </div>

          <div className={styles["cta-row"]}>{button}</div>
        </div>
      </div>
    </BackgroundGradient>
  );
}
