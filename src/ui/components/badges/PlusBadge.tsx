import React from 'react';
import styles from './PlusBadge.module.css';
import Heart18 from "@/assets/svg/18min.svg"

const PlusBadge = () => {
  return (
     <div className={styles.heartContainer}>
    <div className={styles.heart2}>
    <img src={Heart18} alt="" />
    </div>
    <div className={styles.heart}>
      <div className={styles.heartfill}></div>
    </div>
       </div>
  );
};

export default PlusBadge;
