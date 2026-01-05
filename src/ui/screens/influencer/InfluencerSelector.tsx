import React, { useEffect, useMemo, useState } from "react";
import ProfileMedia from "@/ui/components/ProfileMedia";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import styles from "./InfluencerSelector.module.css";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { makeInfluencerList } from "@/dummy/influencers";

export default function InfluencerSelector() {
  const [selected, setSelected] = useState<string | null>();
  const [candidates, setCandidates] = useState<InfluencerDataModel[]>();

  const stage = useMemo<"idle" | "ready">(
    () => (selected ? "ready" : "idle"),
    [selected]
  );

  const button =
    stage === "ready" ? (
      <PrimaryButton
        text="Confirm Selection"
        onClick={() => window.alert(`Selected: ${selected}`)}
        className={styles["cta"]}
      />
    ) : (
      <NormalButton
        text="Confirm Selection"
        disabled
        className={styles["cta-disabled"]}
      />
    );

  useEffect(() => {
    makeInfluencerList(2, "mixed").then((list) => {
      setSelected(list[0].id);
      setCandidates(list)
    });
  }, []);

  return (
    <BackgroundGradient>
      <div className={styles["shell"]}>
        <div className={styles["card"]}>
          <div className={styles["avatar-row"]}>
            {candidates && candidates.map((candidate) => {
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
