import { useState } from "react";
import styles from "./AdultMode.module.css";
import AdultSceneSelector from "@/ui/components/cards/AdultSceneSelectorCard";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import SvgPack from "@/utils/SvgPack";
import adultTitlePlaceholder from "@/assets/adult-mode/local-test/adultTitlePlaceholder.json";
import mainImageDefaultSmall from "@/assets/adult-mode/local-test/images/mainImageDefault.png";
import mainImageDefaultLarge from "@/assets/adult-mode/local-test/images/mainImageDefault@2x.png";
import mainImageGymSmall from "@/assets/adult-mode/local-test/images/mainImageGym.png";
import mainImageGymLarge from "@/assets/adult-mode/local-test/images/mainImageGym@2x.png";
import mainImageHotTeacherSmall from "@/assets/adult-mode/local-test/images/mainImageHotTeacher.png";
import mainImageHotTeacherLarge from "@/assets/adult-mode/local-test/images/mainImageHotTeacher@2x.png";
import mainImageMaidSmall from "@/assets/adult-mode/local-test/images/mainImageMaid.png";
import mainImageMaidLarge from "@/assets/adult-mode/local-test/images/mainImageMaid@2x.png";
import mainImageNurseSmall from "@/assets/adult-mode/local-test/images/mainImageNurse.png";
import mainImageNurseLarge from "@/assets/adult-mode/local-test/images/mainImageNurse@2x.png";
import mainImagePoliceSmall from "@/assets/adult-mode/local-test/images/mainImagePolice.png";
import mainImagePoliceLarge from "@/assets/adult-mode/local-test/images/mainImagePolice@2x.png";
import videoPoster from "@/assets/adult-mode/local-test/video/posterJulianaPolice-min2.png";
import videoMp4 from "@/assets/adult-mode/local-test/video/videoJulianaPolice-min2.mp4";
import videoWebm from "@/assets/adult-mode/local-test/video/videoJulianaPolice-min2.webm";

type Scene = {
  name: string;
  description: string;
  scenarioDetails: string;
  image: {
    small: string;
    large: string;
  };
  video: {
    image: string;
    mp4: string;
    webm: string;
  };
  default?: boolean;
};

type SessionState = "preview" | "active";

export default function AdultMode() {
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("preview");

  const sharedVideo = {
    image: videoPoster,
    mp4: videoMp4,
    webm: videoWebm
  };

  const scenes: Scene[] = [
    {
      name: "Default",
      description: "A playful everyday tease with a familiar, flirty energy.",
      scenarioDetails:
        "You settle into something familiar, warm, and teasing. She knows exactly how to get under your skin with a soft voice, close attention, and just enough affection to keep you wanting more.",
      image: {
        small: mainImageDefaultSmall,
        large: mainImageDefaultLarge
      },
      video: sharedVideo,
      default: true
    },
    {
      name: "Gym",
      description: "Confident, sweaty, and intense. A high-energy workout fantasy.",
      scenarioDetails:
        "She corners you after the workout, body still warm and breathing heavy, with a look that dares you to keep up. Every word is playful, competitive, and charged with tension as she pushes you harder.",
      image: {
        small: mainImageGymSmall,
        large: mainImageGymLarge
      },
      video: sharedVideo
    },
    {
      name: "Hot Teacher",
      description: "Strict, seductive, and impossible to ignore after class.",
      scenarioDetails:
        "Class is over, but she is not finished with you. She keeps you behind, lowers her voice, and turns every correction into something intimate, deliberate, and impossible to stop thinking about.",
      image: {
        small: mainImageHotTeacherSmall,
        large: mainImageHotTeacherLarge
      },
      video: sharedVideo
    },
    {
      name: "Maid",
      description: "Polite on the surface, but full of teasing tension underneath.",
      scenarioDetails:
        "She moves around you with perfect manners and a knowing smile, pretending everything is innocent while making every moment feel charged. The more composed she sounds, the more obvious the teasing becomes.",
      image: {
        small: mainImageMaidSmall,
        large: mainImageMaidLarge
      },
      video: sharedVideo
    },
    {
      name: "Nurse",
      description: "Soft care, close attention, and a dangerously intimate bedside manner.",
      scenarioDetails:
        "She checks on you with soft hands, a calm tone, and far too much focus for anything to feel professional. Every reassuring word draws closer, turning comfort into something deeply personal.",
      image: {
        small: mainImageNurseSmall,
        large: mainImageNurseLarge
      },
      video: sharedVideo
    },
    {
      name: "Police",
      description: "Commanding, bold, and ready to take control of the situation.",
      scenarioDetails:
        "She takes control the second she steps in, voice firm and eyes locked on you. Every order lands with confidence, turning the whole scene into a tense, playful power game that keeps building.",
      image: {
        small: mainImagePoliceSmall,
        large: mainImagePoliceLarge
      },
      video: sharedVideo
    }
  ];

  const handleSelectScenario = (scene: Scene) => {
    setSelectedScene(scene);
    setSessionState("preview");
  };

  const handleCloseScenario = () => {
    setSelectedScene(null);
  };

  const handleStartCall = () => {
    setSessionState("active");
  };

  const handleEndCall = () => {
    setSessionState("preview");
  };

  return (
    <div className={styles.container}>
      {!selectedScene ? (
        <div className={styles.page1}>
          <div className={styles.header}>Select a scenario</div>
          <div className={styles.selectionArea}>
            <div className={`${styles.scenesList} ${scenes.length > 1 ? styles.edgeFade : ""}`}>
              {scenes.map((scene) => (
                <div key={scene.name} className={styles.sceneItem}>
                  <AdultSceneSelector
                    name={scene.name}
                    description={scene.description}
                    imageSmallSrc={scene.image.small}
                    imageLargeSrc={scene.image.large}
                    titlePlaceholderData={adultTitlePlaceholder}
                    default={Boolean(scene.default)}
                  />
                  <IconButton
                    onClick={() => handleSelectScenario(scene)}
                    text="Select Scenario"
                    color="purple-glass"
                    type="pill"
                    className={styles.sceneButton}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.sessionPage}>
          <div className={styles.sessionMedia}>
            <video
              poster={selectedScene.video.image}
              className={`${styles.sessionVideo} ${sessionState === "preview" ? styles.previewVideo : styles.activeVideo}`}
              autoPlay
              loop
              muted
              playsInline
            >
              <source src={selectedScene.video.webm} type="video/webm" />
              <source src={selectedScene.video.mp4} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {sessionState === "preview" && <div className={styles.previewOverlay} />}
            {sessionState === "preview" ? (
              <>
                <IconButton
                  type="pill"
                  color="black"
                  leftIcon={<SvgPack.CloseSquare className={styles.previewCloseIcon} />}
                  onClick={handleCloseScenario}
                  className={styles.previewCloseButton}
                />
                <div className={styles.sessionName}>{selectedScene.name}</div>
                <div className={styles.previewPanel}>
                  <div className={styles.subtitle}>Scenario Details</div>
                  <div className={styles.sessionDescription}>{selectedScene.scenarioDetails}</div>
                  <div className={styles.previewActions}>
                    <IconButton
                      onClick={handleStartCall}
                      color="green"
                      type="pill"
                      className={styles.callButton}
                      leftIcon={<SvgPack.Call />}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.activePanel}>
                <div className={styles.subtitle}>Connected</div>
                <div className={styles.sessionTimer}>00:00</div>
                <div className={styles.activeActions}>
                  <IconButton
                    onClick={handleEndCall}
                    color="red"
                    type="pill"
                    className={styles.activeCallButton}
                    leftIcon={<SvgPack.HangupCallIcon />}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
