import { InfluencerLandingAssetsResponse } from "@/api/models/influencers";
import lpBgMinMp4 from "@/assets/influencerWelcome/video/lpbgmin.mp4";
import lpBgMinPoster from "@/assets/influencerWelcome/video/lpbgminPoster.jpg";
import lpBgMinWebm from "@/assets/influencerWelcome/video/lpbgmin.webm";
import lottieAudioWave from "@/assets/influencerWelcome/lottie/lottieAudiowave.json";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import LottieAnimation from "@/ui/components/LottieAnimation";
import styles from "./InfluencerWelcomeVisuals.module.css";

type InfluencerWelcomeVisualsProps = {
  influencer: InfluencerDataModel;
  landingAssets: InfluencerLandingAssetsResponse | null;
  onHeroLoad?: () => void;
  className?: string;
};

export default function InfluencerWelcomeVisuals({
  influencer,
  landingAssets,
  onHeroLoad,
  className,
}: InfluencerWelcomeVisualsProps) {
  return (
    <div className={`${styles.profileContainer} ${className ?? ""}`}>
      <div className={styles.bgLpVideo}>
        <video autoPlay muted playsInline loop poster={lpBgMinPoster}>
          <source src={lpBgMinWebm} type="video/webm" />
          <source src={lpBgMinMp4} type="video/mp4" />
        </video>
      </div>

      <div className={styles.tileHolder}>
        {landingAssets?.signature_png_url && (
          <div className={styles.imageSignature}>
            <img
              src={landingAssets.signature_png_url}
              alt=""
              srcSet={
                landingAssets.signature_png_2x_url
                  ? `${landingAssets.signature_png_url} 1x, ${landingAssets.signature_png_2x_url} 2x`
                  : undefined
              }
            />
          </div>
        )}

        {landingAssets?.background_image_1_url && (
          <div className={styles.image01}>
            <img
              src={landingAssets.background_image_1_url}
              alt=""
              srcSet={
                landingAssets.background_image_1_2x_url
                  ? `${landingAssets.background_image_1_url} 1x, ${landingAssets.background_image_1_2x_url} 2x`
                  : undefined
              }
            />
          </div>
        )}

        {landingAssets?.background_image_2_url && (
          <div className={styles.image02}>
            <img
              src={landingAssets.background_image_2_url}
              alt=""
              srcSet={
                landingAssets.background_image_2_2x_url
                  ? `${landingAssets.background_image_2_url} 1x, ${landingAssets.background_image_2_2x_url} 2x`
                  : undefined
              }
            />
          </div>
        )}

        {landingAssets?.background_video_1_mp4_url && (
          <div className={styles.lpVideo01}>
            <video
              autoPlay
              muted
              playsInline
              loop
              poster={landingAssets.background_video_1_poster_jpg_url ?? undefined}
            >
              {landingAssets.background_video_1_webm_url && (
                <source
                  src={landingAssets.background_video_1_webm_url}
                  type="video/webm"
                />
              )}
              <source
                src={landingAssets.background_video_1_mp4_url}
                type="video/mp4"
              />
            </video>
          </div>
        )}

        {landingAssets?.background_video_2_mp4_url && (
          <div className={styles.lpVideo02}>
            <video
              autoPlay
              muted
              playsInline
              loop
              poster={landingAssets.background_video_2_poster_jpg_url ?? undefined}
            >
              {landingAssets.background_video_2_webm_url && (
                <source
                  src={landingAssets.background_video_2_webm_url}
                  type="video/webm"
                />
              )}
              <source
                src={landingAssets.background_video_2_mp4_url}
                type="video/mp4"
              />
            </video>
          </div>
        )}

        {landingAssets?.background_image_3_url && (
          <div className={styles.image03}>
            <img
              src={landingAssets.background_image_3_url}
              alt=""
              srcSet={
                landingAssets.background_image_3_2x_url
                  ? `${landingAssets.background_image_3_url} 1x, ${landingAssets.background_image_3_2x_url} 2x`
                  : undefined
              }
            />
          </div>
        )}

        <div className={styles.audioLottie}>
          <LottieAnimation loop autoplay animationData={lottieAudioWave} />
        </div>
      </div>

      {landingAssets?.hero_png_url && (
        <div className={styles.lpBodyShot}>
          <img
            src={landingAssets.hero_png_url}
            alt={influencer?.name}
            srcSet={
              landingAssets.hero_png_2x_url
                ? `${landingAssets.hero_png_url} 1x, ${landingAssets.hero_png_2x_url} 2x`
                : undefined
            }
            onLoad={onHeroLoad}
          />
        </div>
      )}
    </div>
  );
}
