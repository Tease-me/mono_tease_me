import styles from "./AdultMode.module.css";
import AdultSceneSelector from "@/ui/components/cards/AdultSceneSelectorCard";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";


export default function AdultMode() {
  const scenes = [
    {
      name: "Horny Nurse",
      title: "Nurse",
      description: "Start your day with a little tease. Perfect for those who like to wake up slowly and enjoy the anticipation.",
      imageSrc: "/assets/image/scene1.png",
      videoSrc: "/assets/video/scene1.mp4"
    },
    {
      name: "Office Fantasy",
      title: "Office",
      description: "A little escape from the daily grind. Ideal for those who want to add some excitement to their workday.",
      imageSrc: "/assets/image/scene2.png",
      videoSrc: "/assets/video/scene2.mp4"
    },
    {
      name: "Evening Seduction",
      description: "Unwind after a long day with a seductive tease. Great for those who want to relax and indulge in some fantasy.",
      imageSrc: "/assets/image/scene3.png",
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
        <div className={styles.scenesList}>
          {scenes.map((scene) => (
            <div key={scene.name}>
              <AdultSceneSelector
                name={scene.name}
                title={scene.title}
                description={scene.description}
                imageSrc={scene.imageSrc}
              />
              <PrimaryButton
                onClick={handleSelectScenario}
                text="Select Scenario"
                variant="pink"
              />
            </div>
          ))}
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
