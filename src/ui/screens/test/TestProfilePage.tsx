import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import NavigationRow from '@/ui/components/inputs/buttons/NavigationRow';
import UserMenu from '../user-profile/Components/UserMenu';

const TestProfilePage = ({ }) => {
    return (
        <FullWidthLayout>
            <UserMenu />
            <TextInput placeholder='Test Input' style={{margin: 10}}/>
            <NavigationRow title="Test Navigation Row" subtitle="This is a test" onClick={() => {}} />
        </FullWidthLayout>
    );
};

export default TestProfilePage;