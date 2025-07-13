import ProfileMedia from '@/components/ProfileMedia';
import BackgroundGradient from '../../templates/BackgroundGradient';
import './TestPage.module.css';
import oliviaImage from "@/assets/image/avatar.png"
import oliviaVideo from "@/assets/video/avatar_video.mp4";

const TestPage = ({ }) => {

    return (
        <div className="test-page">
            <BackgroundGradient />
            <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} />
            <ProfileMedia mediaType='image' imageSrc={oliviaImage} videoSrc={oliviaVideo} />
        </div>
    );
};

export default TestPage;