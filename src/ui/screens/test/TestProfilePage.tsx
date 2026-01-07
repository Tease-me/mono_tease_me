import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import NavigationRow from '@/ui/components/inputs/buttons/NavigationRow';

const TestProfilePage = ({ }) => {
    return (
        <FullWidthLayout>
            <TextInput placeholder='Test Input' style={{margin: 10}}/>
            <NavigationRow title="Test Navigation Row" subtitle="This is a test" onClick={() => {}} />
        </FullWidthLayout>
    );
};

export default TestProfilePage;