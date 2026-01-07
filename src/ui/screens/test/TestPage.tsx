import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import { useState } from 'react';
import AdultModeToggleContainer from '@/ui/components/adult-mode-toggle/AdultModeToggleContainer';


const TestPage = ({ }) => {
    const [toggleState, setToggleState] = useState(false);

    return (
        <FullWidthLayout>
            <div style={{ padding: 10 }}>
                <AdultModeToggleContainer checked={toggleState} onChange={() => setToggleState(!toggleState)} />
            </div>
        </FullWidthLayout>
    );
};

export default TestPage;