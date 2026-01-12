import React, { useEffect, useState } from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import ChatScreenContent from "../messaging/components/ChatScreenContent";
import InfluencerSelector from "../influencer/InfluencerSelector";


export default function HomeScreenSingle() {
  const storedId = localStorage.getItem("selected_id");
  const [id, setId] = useState<string | undefined>(storedId ? storedId : undefined);
  const [needsSelection, setNeedsSelection] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  // const [hasMultipleInfluencers, setHasMultipleInfluencers] = useState(false);

  useEffect(() => {
    localStorage.setItem("selected_id", id?.toString() || "");
  }, [id]);
  useEffect(() => {
    const influencerRepo = InfluencerRepo();
    influencerRepo
      .getFollowedInfluencers()
      .then((influencers: InfluencerDataModel[]) => {
        if (influencers.length > 1) {
          setNeedsSelection(true);
          // setHasMultipleInfluencers(true);
        } else if (influencers.length === 1) {
          setId(influencers[0].id);
          // setHasMultipleInfluencers(false);
        }
        setInfluencers(influencers);
      });
  }, []);

  const handleSelect = (selectedId: string) => {
    setId(selectedId);
    setNeedsSelection(false);
  };

  return (
    <BackgroundGradient>
      {needsSelection && !id ? (
        <InfluencerSelector onItemClick={handleSelect} influencers={influencers} />
      ) : (
        <ChatScreenContent id={id} />
      )}
    </BackgroundGradient>
  );
}
