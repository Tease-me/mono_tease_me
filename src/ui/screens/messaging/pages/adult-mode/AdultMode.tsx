import styles from "./AdultMode.module.css";
import AdultSceneSelector from "@/ui/components/cards/AdultSceneSelectorCard";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import SvgPack from "@/utils/SvgPack";


export default function AdultMode() {
  const scenes = [
    {
      name: "Default",
      title: "Girlfriend",
      description: "Start your day with a little tease. Perfect for those who like to wake up slowly and enjoy the anticipation.",
      imageSrc: "https://static.vecteezy.com/system/resources/thumbnails/046/822/632/small/a-businesswoman-in-a-sharp-outfit-isolated-on-a-transparent-background-png.png",
      videoSrc: "/assets/video/scene1.mp4",
      default: true
    },
    {
      name: "Office Fantasy",
      title: "Office",
      description: "A little escape from the daily grind. Ideal for those who want to add some excitement to their workday.",
      imageSrc: "https://static.vecteezy.com/system/resources/previews/046/613/575/non_2x/cute-model-girl-with-clean-healthy-skin-on-transparent-background-free-png.png",
      videoSrc: "/assets/video/scene2.mp4"
    },
    {
      name: "Evening Seduction",
      title: "Police",
      description: "Unwind after a long day with a seductive tease. Great for those who want to relax and indulge in some fantasy.",
      imageSrc: "https://static.vecteezy.com/system/resources/previews/046/613/575/non_2x/cute-model-girl-with-clean-healthy-skin-on-transparent-background-free-png.png",
      videoSrc: "/assets/video/scene3.mp4"
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
                  title={scene.title}
                  description={scene.description}
                  imageSrc={scene.imageSrc}
                  girlfriend={Boolean(scene.default)}
                />
                <IconButton
                  onClick={handleSelectScenario}
                  text={scene.default ? "Girlfriend Mode" : "Select Scenario"}
                  color={scene.default ? "pink-glass" : "purple-glass"}
                  type="pill"
                  className={styles.sceneButton}
                  leftIcon={scene.default ? <SvgPack.Heart /> : undefined}
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
