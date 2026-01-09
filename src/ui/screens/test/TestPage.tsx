import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import { useState } from 'react';
import AdultModeToggle from '@/ui/components/adult-mode-toggle/AdultModeToggle';


const TestPage = ({ }) => {
    const [toggleState, setToggleState] = useState(false);

    return (
        <FullWidthLayout>
            <div style={{ padding: 10, width: 200 }}>
                <AdultModeToggle checked={toggleState} onChange={() => setToggleState(!toggleState)} />
            </div>
        </FullWidthLayout>
    );
};

export default TestPage;