import React from 'react';
import clsx from 'clsx';
import styles from './FadingDivider.module.css';


export default function FadingDivider() {

  return (
    <div className={clsx(styles.divider,)} aria-hidden>
    </div>)


}   