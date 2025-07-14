import ProfileMedia from '@/components/ProfileMedia';
import BackgroundGradient from '../../templates/BackgroundGradient';
import styles from './TestPage.module.css';
import oliviaImage from "@/assets/image/avatar.png"
import oliviaVideo from "@/assets/video/avatar_video.mp4";
import CenteredLayout from '@/templates/CenteredLayout';

const TestPage = ({ }) => {

    return (
        <BackgroundGradient>
            <CenteredLayout>
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} />
                <ProfileMedia mediaType='image' imageSrc={oliviaImage} videoSrc={oliviaVideo} />
            </CenteredLayout>
        </BackgroundGradient>
    );
};

export default TestPage;