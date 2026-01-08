//import UserMenu from '../user-profile/Components/UserMenu';
import PaymentDetails from '../user-profile/Components/PaymentDetails';
import ChatScreenContent from '../messaging/components/ChatScreenContent';
import SlideDrawerLayout from '@/ui/templates/SlideDrawerLayout';
//import UserMenu from '../user-profile/Components/UserMenu';
import UserMenu from '../user-profile/Components/UserMenu';
import {useState} from "react"
import UserProfile from '../user-profile/UserProfile';
import MyInfluencers from '../user-profile/Components/MyInfluencers';
import UserNav from '@/ui/components/nav/UserNav';

const sidebarPages = [
  { id: 'home', label: 'Home', component: <UserMenu /> },
  { id: 'profile', label: 'User Profile', component: <UserProfile /> },
  { id: 'payment', label: 'Payment Details', component: <PaymentDetails /> },
  { id: 'influencers', label: 'My Influencers', component: <MyInfluencers /> },
];

const [currentPage, setCurrentPage] = useState('home');
const [history, setHistory] = useState<string[]>([]);

const nextPage = (id: string) => {
    setHistory((h) => [...h, currentPage]);
}

const prevPage = () => {
    setHistory((h) => {
        const prev=h[h.length-1] ?? 'home';
        setCurrentPage(prev);
        return h.slice(0, -1);

    })
}

const TestProfilePage = ({ }) => {

const [showSidebar, setShowSidebar] = useState(false);

    return (
        <div>

            <SlideDrawerLayout showSidebar={showSidebar} sidebar={<PaymentDetails />} onToggle={ () => setShowSidebar(prev => !prev)}>
                    <ChatScreenContent id='loli' onMenuClick={ () => setShowSidebar(prev => !prev)} />
            </SlideDrawerLayout>
        </div>
    );
};

export default TestProfilePage;