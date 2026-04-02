import React from 'react';
import styles from "./ButtonsTestPage.module.css"
import IconButton from '@/ui/components/inputs/buttons/IconButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import SvgPack from '@/utils/SvgPack';
import AnimatedButton from '@/ui/components/inputs/buttons/AnimatedButton';
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';

interface ButtonsTestPageProps {
}

const ButtonsTestPage: React.FC<ButtonsTestPageProps> = ({ }) => {
    const circularSizes = ["xsmall", "small", "medium", "large"] as const;
    const circularVariants = ["primary", "secondary", "tertiary"] as const;

    return (
        <div className={styles["container"]}>
            <h1>Tease Me Buttons</h1>
            <h2>CTA</h2>
            <div className={styles["grid-test"]}>
                <PrimaryButton
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <PrimaryButton
                    leftIcon={<SvgPack.Call />}
                    disabled
                    text='Welcome to TeaseMe'
                />
                <PrimaryButton
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
            </div>
            <h2>CTA Purple</h2>
            <div className={styles["grid-test"]}>
                <PrimaryButton
                    variant='purple'
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <PrimaryButton
                    variant='purple'
                    leftIcon={<SvgPack.Call />}
                    disabled
                    text='Welcome to TeaseMe'
                />
                <PrimaryButton
                    variant='purple'
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
            </div>
            <h2>Normal</h2>
            <h3>Normal Pill</h3>
            <div className={styles["grid-test"]}>
                <NormalButton
                    type="pill"
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <NormalButton
                    type="pill"
                    leftIcon={<SvgPack.Call />}
                    disabled
                    text='Welcome to TeaseMe' />
                <NormalButton
                    type="pill"
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
            </div>
            <h3>Normal Square</h3>
            <div className={styles["grid-test"]}>
                <NormalButton
                    type="square"
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <NormalButton
                    type="square"
                    leftIcon={<SvgPack.Call />}
                    disabled
                    text='Welcome to TeaseMe' />
                <NormalButton
                    type="square"
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
            </div>
            <h3>Normal No Background</h3>
            <div className={styles["grid-test"]}>
                <NormalButton
                    type="nobg"
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <NormalButton
                    type="nobg"
                    leftIcon={<SvgPack.Call />}
                    disabled
                    text='Welcome to TeaseMe' />
                <NormalButton
                    type="nobg"
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
            </div>
            <h2>Icon Text</h2>
            <h3>Icon Text - Animated Button</h3>
            <div className={styles["grid-test"]}>
                <AnimatedButton
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <AnimatedButton
                    leftIcon={<SvgPack.Call />}
                    disabled
                    text='Welcome to TeaseMe'
                />
                <AnimatedButton
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
            </div>
            <h3>Icon Text</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    type="pill"
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <IconButton
                    type="pill"
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
                <IconButton
                    type="pill"
                    disabled
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
            </div>
            <h3>Icon Text - Vertical</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    type="pill"
                    orientation='vertical'
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <IconButton
                    type="pill"
                    orientation='vertical'
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
                <IconButton
                    type="pill"
                    orientation='vertical'
                    disabled
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
            </div>
            <h3>Icon Text - Square</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    type="square"
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
                <IconButton
                    type="square"
                    orientation='vertical'
                    leftIcon={<SvgPack.Call />}
                    selected
                    text='Welcome to TeaseMe'
                />
                <IconButton
                    type="square"
                    orientation='vertical'
                    disabled
                    leftIcon={<SvgPack.Call />}
                    text='Welcome to TeaseMe'
                />
            </div>
            <h3>Icon Text - Black</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    color='black'
                    type="pill"
                    text='Welcome to TeaseMe'
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='black'
                    type="pill"
                    text='Welcome to TeaseMe'
                    selected
                    leftIcon={<SvgPack.Call />} />
                <IconButton
                    color='black'
                    type="pill"
                    text='Welcome to TeaseMe'
                    disabled
                    leftIcon={<SvgPack.Call />}
                />
            </div>
            <h3>Icon Text - Pink</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    color='pink'
                    type="pill"
                    text='Welcome to TeaseMe'
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='pink'
                    type="pill"
                    text='Welcome to TeaseMe'
                    selected
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='pink'
                    type="pill"
                    text='Welcome to TeaseMe'
                    disabled
                    leftIcon={<SvgPack.Call />}
                />
            </div>

            <h3>Icon Text - Green</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    color='green'
                    type="pill"
                    text='Welcome to TeaseMe'
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='green'
                    type="pill"
                    selected
                    text='Welcome to TeaseMe'
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='green'
                    type="pill"
                    text='Welcome to TeaseMe'
                    disabled
                    leftIcon={<SvgPack.Call />}
                />
            </div>
            <h3>Icon Text - Red</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    color='red'
                    type="pill"
                    text='Welcome to TeaseMe'
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='red'
                    type="pill"
                    text='Welcome to TeaseMe'
                    selected
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='red'
                    type="pill"
                    text='Welcome to TeaseMe'
                    disabled
                    leftIcon={<SvgPack.Call />}
                />
            </div>
            <h3>Icon Text - Yellow</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    color='yellow'
                    type="pill"
                    text='Welcome to TeaseMe'
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='yellow'
                    type="pill"
                    text='Welcome to TeaseMe'
                    selected
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='yellow'
                    type="pill"
                    text='Welcome to TeaseMe'
                    disabled
                    leftIcon={<SvgPack.Call />}
                />
            </div>

            <h3>Icon Text - Pink Glass</h3>
            <div className={styles["grid-test"]}>
                <IconButton
                    color='pink-glass'
                    type="pill"
                    text='Welcome to TeaseMe'
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='pink-glass'
                    type="pill"
                    text='Welcome to TeaseMe'
                    selected
                    leftIcon={<SvgPack.Call />}
                />
                <IconButton
                    color='pink-glass'
                    type="pill"
                    text='Welcome to TeaseMe'
                    disabled
                    leftIcon={<SvgPack.Call />}
                />
            </div>
            <h3>Icon Text Icon Only</h3>
            <div className={styles["grid-test"]}>
                <div>
                    <IconButton
                        type="pill"
                        leftIcon={<SvgPack.Call />}
                    />
                </div>
            </div>

            <h2>Circular Icon Button</h2>
            <h3>Icon Only Sizes</h3>
            <div className={styles["grid-test"]}>
                {circularSizes.map((size) => (
                    <CircularIconButton
                        key={size}
                        size={size}
                        icon={<SvgPack.Call />}
                        aria-label={`Circular icon button ${size}`}
                    />
                ))}
            </div>

            <h3>Variants</h3>
            <div className={styles["grid-test"]}>
                {circularVariants.map((variant) => (
                    <CircularIconButton
                        key={variant}
                        variant={variant}
                        icon={<SvgPack.Call />}
                        text={variant}
                    />
                ))}
            </div>

            <h3>Disabled Variants</h3>
            <div className={styles["grid-test"]}>
                {circularVariants.map((variant) => (
                    <CircularIconButton
                        key={`${variant}-disabled`}
                        variant={variant}
                        icon={<SvgPack.Call />}
                        text={variant}
                        disabled
                    />
                ))}
            </div>

            <h3>Content Modes</h3>
            <div className={styles["grid-test"]}>
                <CircularIconButton
                    icon={<SvgPack.Call />}
                    aria-label="Icon only circular icon button"
                />
                <CircularIconButton
                    text="Top up"
                />
                <CircularIconButton
                    icon={<SvgPack.Call />}
                    text="Call now"
                />
            </div>

            <h3>Disabled Content Modes</h3>
            <div className={styles["grid-test"]}>
                <CircularIconButton
                    icon={<SvgPack.Call />}
                    aria-label="Disabled icon only circular icon button"
                    disabled
                />
                <CircularIconButton
                    text="Top up"
                    disabled
                />
                <CircularIconButton
                    icon={<SvgPack.Call />}
                    text="Call now"
                    disabled
                />
            </div>
        </div>
    );
};

export default ButtonsTestPage;
