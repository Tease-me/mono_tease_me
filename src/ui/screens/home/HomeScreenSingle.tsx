import React, { useEffect, useState } from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import ChatScreenContent from "../messaging/components/ChatScreenContent";

export default function HomeScreenSingle() {
  const [id, setId] = useState<string | undefined>(undefined);
  useEffect(() => {
    const influencerRepo = InfluencerRepo();
    influencerRepo.getInfluencers().then((influencers: InfluencerDataModel[]) => {
      influencers.length > 0 && setId(influencers[0].id)
    })
  }, [])


  return (
    <BackgroundGradient>
      <ChatScreenContent id={id} />
    </BackgroundGradient>
  );
}
