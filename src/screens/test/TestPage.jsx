import ProfileMedia from '@/components/ProfileMedia';
import BackgroundGradient from '../../templates/BackgroundGradient';
import styles from './TestPage.module.css';
import oliviaImage from "@/assets/image/avatar.png"
import oliviaVideo from "@/assets/video/avatar_video.mp4";
import CenteredLayout from '@/templates/CenteredLayout';
import AudioLine from '@/components/visualizations/AudioLine';
import { Canvas } from '@react-three/fiber';

const TestPage = ({ }) => {

    return (
        <BackgroundGradient>
            <CenteredLayout>
                <ProfileMedia mediaType='image' imageSrc={oliviaImage} videoSrc={"oliviaVideo"} size='xsmall' active />
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} size='small' />
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} size='medium' />
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} size='large' active />
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} size='xlarge' active showHearts />

            </CenteredLayout>
        </BackgroundGradient>
    );
};

export default TestPage;