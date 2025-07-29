import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import LogoutIcon from "@/assets/Call.svg?react";

const TestPage = ({ }) => {


    return (
        <FullWidthLayout>
            <CircularIconButton icon={<LogoutIcon />} text='Call'></CircularIconButton>
        </FullWidthLayout>

    );
};

export default TestPage;