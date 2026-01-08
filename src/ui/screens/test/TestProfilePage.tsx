//import UserMenu from '../user-profile/Components/UserMenu';
import PaymentDetails from '../user-profile/Components/PaymentDetails';
import ChatScreenContent from '../messaging/components/ChatScreenContent';
import SlideDrawerLayout from '@/ui/templates/SlideDrawerLayout';
//import UserMenu from '../user-profile/Components/UserMenu';
import UserMenu from '../user-profile/Components/UserMenu';
import { useState } from "react"
import UserProfile from '../user-profile/UserProfile';
import MyInfluencers from '../user-profile/Components/MyInfluencers';
import UserNav from '@/ui/components/nav/UserNav';

const sidebarPages = [
    { id: 'home', label: 'Home', sidebarPage: <UserMenu /> },
    { id: 'profile', label: 'User Profile', sidebarPage: <UserProfile /> },
    { id: 'payment', label: 'Payment Details', sidebarPage: <PaymentDetails /> },
    { id: 'influencers', label: 'My Influencers', sidebarPage: <MyInfluencers /> },
];


const TestProfilePage = ({ }) => {

    const [showSidebar, setShowSidebar] = useState(false);

    const [currentPage, setCurrentPage] = useState('home');
    const [history, setHistory] = useState<string[]>([]);


    const goTo= (id: string) => {
        setHistory((h) => [...h, currentPage]);
        setCurrentPage(id)
    }

    const active = sidebarPages.find(p => p.id === currentPage)  || 0;

    const prevPage = () => {
        setHistory((h) => {
            const prev = h[h.length - 1] ?? 'home';
            setCurrentPage(prev);
            return h.slice(0, -1);

        })
    }

    return (
        <div>

            <SlideDrawerLayout
                showSidebar={showSidebar}
                sidebar={<UserMenu />}
                onBack={prevPage}
                onToggle={() => setShowSidebar(prev => !prev)}
                showBack={true}
                title={""}>
                
                <ChatScreenContent id='loli' onMenuClick={() => setShowSidebar(prev => !prev)} />
            </SlideDrawerLayout>
        </div>
    );
};

export default TestProfilePage;