import React from "react";
import { useParams } from "react-router-dom";
import InfluencerAudioManager from "./InfluencerAudioManager";

const InfluencerAudioManagerRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Missing influencer id in the URL.</div>;
  }

  return <InfluencerAudioManager influencerId={id} />;
};

export default InfluencerAudioManagerRoute;
