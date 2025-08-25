import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import LogoutIcon from "@/assets/Call.svg?react";
import AnimatedButton from '@/ui/components/inputs/buttons/AnimatedButton';

const TestPage = ({ }) => {


    return (
        <FullWidthLayout>
            <CircularIconButton icon={<LogoutIcon />} text='Call'></CircularIconButton>
            <AnimatedButton leftIcon={<LogoutIcon />} text='Answer' />
        </FullWidthLayout>

    );
};

export default TestPage;