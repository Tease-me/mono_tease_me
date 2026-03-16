import styles from "./AdultMode.module.css";
import AdultSceneSelector from "@/ui/components/cards/AdultSceneSelectorCard";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
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

export default function AdultMode() {
  const sharedVideo = {
    image: videoPoster,
    mp4: videoMp4,
    webm: videoWebm
  };

  const scenes: Scene[] = [
    {
      name: "Default",
      description: "A playful everyday tease with a familiar, flirty energy.",
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
      image: {
        small: mainImageGymSmall,
        large: mainImageGymLarge
      },
      video: sharedVideo
    },
    {
      name: "Hot Teacher",
      description: "Strict, seductive, and impossible to ignore after class.",
      image: {
        small: mainImageHotTeacherSmall,
        large: mainImageHotTeacherLarge
      },
      video: sharedVideo
    },
    {
      name: "Maid",
      description: "Polite on the surface, but full of teasing tension underneath.",
      image: {
        small: mainImageMaidSmall,
        large: mainImageMaidLarge
      },
      video: sharedVideo
    },
    {
      name: "Nurse",
      description: "Soft care, close attention, and a dangerously intimate bedside manner.",
      image: {
        small: mainImageNurseSmall,
        large: mainImageNurseLarge
      },
      video: sharedVideo
    },
    {
      name: "Police",
      description: "Commanding, bold, and ready to take control of the situation.",
      image: {
        small: mainImagePoliceSmall,
        large: mainImagePoliceLarge
      },
      video: sharedVideo
    }
  ];

  const handleSelectScenario = () => {
    ///  Select
  };

  return (
    <div className={styles.container}>
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
                  onClick={handleSelectScenario}
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

      <div className={styles.page2}>
        <div className={styles.notCallling}>
          <div className={styles.name}></div>
          <div className={styles.description}></div>
        </div>
        <div className={styles.calling}>
          <div className={styles.subtitle}>Calling...</div>


        </div>



      </div>
    </div>
  );
}
