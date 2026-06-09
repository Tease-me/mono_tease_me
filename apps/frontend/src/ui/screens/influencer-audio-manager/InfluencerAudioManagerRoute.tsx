import React from "react";
import { useParams } from "react-router-dom";
import InfluencerAudioManager from "./InfluencerAudioManager";

const InfluencerAudioManagerRoute: React.FC = () => {
  const { influencer_id } = useParams<{ influencer_id: string }>();

  if (!influencer_id) {
    return <div>Missing influencer id in the URL.</div>;
  }

  return <InfluencerAudioManager influencerId={influencer_id} />;
};

export default InfluencerAudioManagerRoute;
