import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import AnimatedButton from '@/ui/components/inputs/buttons/AnimatedButton';
import SvgPack from '@/utils/SvgPack';

const TestPage = ({ }) => {
    return (
        <FullWidthLayout>
            <AnimatedButton leftIcon={<SvgPack.Calling />} text='Answer' color='green' />
        </FullWidthLayout>

    );
};

export default TestPage;