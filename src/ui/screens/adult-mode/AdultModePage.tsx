import styles from "./AdultModePage.module.css";
import PlayIcon from "@/assets/svg/Play.svg?react";
import MicrophoneIcon from "@/assets/Microphone.svg?react";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import avatarImage from "@/assets/image/avatar.png";

const waveformBars = new Array(24).fill(0);

const AdultModePage = ({ onSubscribePressed }: { onSubscribePressed: () => void }) => {
  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <header className={styles.header}>
          <span className={styles.headerAccent}>18+</span> Mode
        </header>

        <section className={styles.card}>
          <div className={styles.avatar}>
            <img src={avatarImage} alt="Influencer avatar" />
          </div>
          <div className={styles.cardText}>
            <div className={styles.title}>Adult Chat</div>
            <p>
              Receive access to more adult conversations including explicit
              messages.
            </p>
          </div>
        </section>

        <section className={styles.audioList}>
          <div className={styles.audioRow}>
            <div className={styles.avatar}>
              <img src={avatarImage} alt="Influencer avatar" />
            </div>
            <div className={styles.audioCard}>
              <div className={styles.title}>Audio Sample 01</div>
              <div className={styles.audioPill}>
                <button className={styles.playButton} type="button">
                  <PlayIcon />
                </button>
                <div className={styles.waveform} aria-hidden="true">
                  {waveformBars.map((_, index) => (
                    <span key={`wave-${index}`} />
                  ))}
                </div>
                <span className={styles.duration}>5sec</span>
              </div>
            </div>
          </div>

          <div className={styles.audioRow}>
            <div className={styles.avatar}>
              <img src={avatarImage} alt="Influencer avatar" />
            </div>
            <div className={styles.audioCard}>
              <div className={styles.title}>Audio Sample 02</div>
              <div className={styles.audioPill}>
                <button className={styles.playButton} type="button">
                  <PlayIcon />
                </button>
                <div className={styles.waveform} aria-hidden="true">
                  {waveformBars.map((_, index) => (
                    <span key={`wave-alt-${index}`} />
                  ))}
                </div>
                <span className={styles.duration}>5sec</span>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.bottomSection}>
          <p className={styles.tagline}>Let&apos;s heat things up...</p>

          <div className={styles.subscribeButton}>
            <PrimaryButton leftIcon={<MicrophoneIcon />} text="Subscribe" onClick={onSubscribePressed} variant="purple" />
          </div>

          <div className={styles.footer}>
            <p>$99 a month (100mins per month) until cancelled.</p>
            <p className={styles.bonus}>
              Subscribe Today for Early Bird Bonus
              <br />
              Extra 15mins free every month!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdultModePage;
