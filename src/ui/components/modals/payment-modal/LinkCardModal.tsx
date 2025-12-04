import React, { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { Modal } from "../Modal";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import CheckBox from "@/ui/components/inputs/check-boxes/CheckBox";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import SvgPack from "@/utils/SvgPack";

import styles from "./LinkCardModal.module.css";

export interface LinkCardDetails {
    cardHolderName: string;
    cardNumber: string;
    expiry: string;
    securityCode: string;
    acceptedTerms: boolean;
}

interface LinkCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: (details: LinkCardDetails) => void;
    initialValues?: Partial<LinkCardDetails>;
    termsHref?: string;
}

const LinkCardModal: React.FC<LinkCardModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    initialValues,
    termsHref = "/terms-and-conditions",
}) => {
    const [cardHolderName, setCardHolderName] = useState(initialValues?.cardHolderName ?? "");
    const [cardNumber, setCardNumber] = useState(initialValues?.cardNumber ?? "");
    const [expiry, setExpiry] = useState(initialValues?.expiry ?? "");
    const [securityCode, setSecurityCode] = useState(initialValues?.securityCode ?? "");
    const [acceptedTerms, setAcceptedTerms] = useState(initialValues?.acceptedTerms ?? false);

    useEffect(() => {
        if (!isOpen) return;
        setCardHolderName(initialValues?.cardHolderName ?? "");
        setCardNumber(initialValues?.cardNumber ?? "");
        setExpiry(initialValues?.expiry ?? "");
        setSecurityCode(initialValues?.securityCode ?? "");
        setAcceptedTerms(initialValues?.acceptedTerms ?? false);
    }, [isOpen, initialValues]);

    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    const handleSubmit = useCallback(() => {
        if (!acceptedTerms || !cardHolderName.trim() || !cardNumber.trim() || !expiry.trim() || !securityCode.trim()) {
            return;
        }

        const payload: LinkCardDetails = {
            cardHolderName: cardHolderName.trim(),
            cardNumber: cardNumber.trim(),
            expiry: expiry.trim(),
            securityCode: securityCode.trim(),
            acceptedTerms,
        };

        onSubmit?.(payload);
    }, [acceptedTerms, cardHolderName, cardNumber, expiry, securityCode, onSubmit]);

    const submitDisabled = useMemo(() => {
        return !acceptedTerms || !cardHolderName.trim() || !cardNumber.trim() || !expiry.trim() || !securityCode.trim();
    }, [acceptedTerms, cardHolderName, cardNumber, expiry, securityCode]);

    const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleSubmit();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="md" className={styles.modal} ariaLabel="Link your card">
            <div className={styles.content}>
                <TeaseMeLogo className={styles.logo} variant="mono-lips-only" size="small" />
                <h2 className={styles.heading}>Link your Card</h2>

                <form className={styles.form} onSubmit={handleFormSubmit}>
                    <TextInput
                        className={styles.fullWidthInput}
                        leftIcon={<SvgPack.Profile />}
                        placeholder="Card Holder Name"
                        value={cardHolderName}
                        onChange={(event) => setCardHolderName(event.currentTarget.value)}
                        aria-label="Card holder name"
                    />

                    <TextInput
                        className={styles.fullWidthInput}
                        leftIcon={<SvgPack.Bill />}
                        placeholder="0000 0000 0000 0000"
                        value={cardNumber}
                        onChange={(event) => setCardNumber(event.currentTarget.value)}
                        inputMode="numeric"
                        aria-label="Card number"
                    />

                    <div className={styles.inlineFields}>
                        <TextInput
                            className={clsx(styles.fullWidthInput, styles.inlineFieldInput)}
                            leftIcon={<SvgPack.Lock />}
                            placeholder="0000"
                            value={securityCode}
                            onChange={(event) => setSecurityCode(event.currentTarget.value)}
                            inputMode="numeric"
                            aria-label="Security code"
                        />
                        <TextInput
                            className={clsx(styles.fullWidthInput, styles.inlineFieldInput)}
                            leftIcon={<SvgPack.Chat />}
                            placeholder="MM/YY"
                            value={expiry}
                            onChange={(event) => setExpiry(event.currentTarget.value)}
                            aria-label="Expiry date"
                        />
                    </div>

                    <a className={styles.termsLink} href={termsHref} target="_blank" rel="noreferrer">
                        Terms &amp; Conditions
                    </a>

                    <CheckBox
                        className={styles.checkbox}
                        checked={acceptedTerms}
                        onChange={(checked) => setAcceptedTerms(checked)}
                    >
                        I agree to the Terms and Conditions
                    </CheckBox>

                    <div className={styles.actions}>
                        <NormalButton
                            type="nobg"
                            text="Cancel"
                            onClick={handleClose}
                            className={styles.cancelButton}
                        />
                        <PrimaryButton
                            text="Link My Card"
                            onClick={handleSubmit}
                            className={styles.linkButton}
                            disabled={submitDisabled}
                            aria-disabled={submitDisabled}
                        />
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default LinkCardModal;
