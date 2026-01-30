import React, { useState } from 'react'
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton'
import IconButton from '@/ui/components/inputs/buttons/IconButton'
import ProfileMedia from '@/ui/components/ProfileMedia'
import styles from "./AddCredits.module.css"
import TextInput from '@/ui/components/inputs/text-inputs/TextInput'
import { BillingServices } from '@/api/services/BillingServices'
import { apiClient } from '@/api/apis'
import NormalButton from '@/ui/components/inputs/buttons/NormalButton'


const billing = BillingServices(apiClient);



//TODO
//FIX THE DOLLAR ICON NOT SHOWING WHEN MIN-WIDTH IS SET ON THE TEXT INPUT

type navPayLoad = Record<string, any>;

type Props = {
  navpayload: navPayLoad,
  goTo: (id: string, payLoad?: navPayLoad) => void;
}

type Presets = {
  label: string,
  value: number;
}

const presets: Presets[] = [
  { label: "10$", value: 10 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 }
]

export default function AddCredits({ navpayload, goTo }: Props) {

  const data = {
    id: navpayload.influencerId,
    image: navpayload.image,
    video: navpayload.video
  }
  const initialAmount = 0;

  const [amount, setAmount] = useState(initialAmount);

  const handleDecrease = () => setAmount((a) => Math.max(0, a - 10));
  const handleIncrease = () => setAmount((a) => a + 10);

  const handleConfirmPayment = () => {
    startPayPalTopUp()
  }

  // PayPal state
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const minCustomAmout = 5;

  const startPayPalTopUp = async () => {
    try {
      setIsPaying(true);
      setPayError(null);

      const dollars = Number(amount || 0);
      if (!Number.isFinite(dollars) || dollars < minCustomAmout) {
        setPayError(`Minimum top up is $${minCustomAmout}.`);
        return;
      }

      const cents = Math.round(dollars * 100);

      // Create PayPal order on backend (cookie auth)
      const { approve_url, order_id } = await billing.paypalCreateOrder({
        cents,
        currency: "AUD",
        influencer_id: data.id
      });

      // store for return page fallback
      localStorage.setItem("paypal_topup_order_id", order_id);
      localStorage.setItem("paypal_topup_influencer_id", data.id);
      localStorage.setItem("paypal_topup_amount", String(dollars));

      // redirect user to PayPal approval page
      window.location.href = approve_url;
    } catch (e: any) {
      setPayError(e?.message || "PayPal top up failed. Please try again.");
      // setTopUpState("error");
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancel = () => {
    goTo('influencer_profile')
  }


  return (

    <div className={styles.addCredits}>
      <ProfileMedia size='large' videoSrc={data.video} active />

      <div className={styles.selectionBox}>

        <div className={styles.presetsBox}>
          <h4>Quick Presets</h4>
          <div className={styles.presetList}>
            {presets.map((p) => (
              <IconButton key={p.value} text={p.label} color='black' type='pill' onClick={() => { setAmount(p.value) }} />
            ))}
          </div>
        </div>

        <div className={styles.customAmountArea}>
          <IconButton text={"-"} color='black' type='pill' onClick={handleDecrease} className={styles.customBtn} />
          <TextInput leftIcon="$" className={styles.amountInput} type='number' value={`${amount}`}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setAmount(Number(e.target.value) || 0)
            }}
            size='medium' />
          <IconButton text={"+"} color='black' type='pill' onClick={handleIncrease} className={styles.customBtn} />
        </div>
        <PrimaryButton text='Confirm' disabled={amount <= 0} className={styles.confirmBtn} onClick={handleConfirmPayment} />
        <NormalButton text='Cancel' type='nobg' className={styles.confirmBtn} onClick={handleCancel} />
        {payError && <div className={styles.payError}>{isPaying ? "" : payError}</div>}

      </div>

    </div>


  )

}
