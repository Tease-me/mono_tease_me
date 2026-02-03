import AddCreditsContent from "./AddCreditsContent";

type navPayLoad = Record<string, any>;

type Props = {
  navpayload: navPayLoad;
  goTo: (id: string, payLoad?: navPayLoad) => void;
};

export default function AddCredits({ navpayload, goTo }: Props) {
  return (
    <AddCreditsContent
      influencerId={navpayload.influencerId}
      image={navpayload.image}
      video={navpayload.video}
      onCancel={() => goTo("influencer_profile")}
    />
  );
}
