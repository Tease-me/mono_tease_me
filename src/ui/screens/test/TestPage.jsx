import ProfileMedia from '@/ui/components/ProfileMedia';
import BackgroundGradient from '../../templates/BackgroundGradient';
import styles from './TestPage.module.css';
import oliviaImage from "@/assets/image/avatar.png"
import oliviaVideo from "@/assets/video/avatar_video.mp4";
import CenteredLayout from '@/ui/templates/CenteredLayout';
import AudioLine from '@/ui/components/visualizations/AudioLine';
import { Canvas } from '@react-three/fiber';
import TwoPaneLayout from '@/ui/templates/TwoPaneLayout';
import HomeScreen from '../home/HomeScreen';
import ChatScreen from '../messaging/ChatScreen';
import HomeScreenContent from '../home/components/HomeScreenContent';
import ChatScreenContent from '../messaging/components/ChatScreenContent';

const TestPage = ({ }) => {

    return (
        <BackgroundGradient>
            {/* <CenteredLayout>
                <ProfileMedia mediaType='image' imageSrc={oliviaImage} size='xsmall' active />
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} size='small' />
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} size='medium' />
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} size='large' active />
                <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} size='xlarge' active showHearts />
            </CenteredLayout> */}
            <TwoPaneLayout nav={<HomeScreenContent />}>
                <ChatScreenContent />
            </TwoPaneLayout>
        </BackgroundGradient>
    );
};

export default TestPage;