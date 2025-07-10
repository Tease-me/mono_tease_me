import BackgroundGradient from '../../components/BackgroundGradient';
import './TestPage.module.css';

const TestPage = ({ }) => {

    return (
        <div className="test-page">
            <BackgroundGradient />
            <div className="center items-center justify-center">
                <div className="card bg-base-300 rounded-box grid h-20 place-items-center">content</div>
                <div className="divider">OR</div>
                <div className="card bg-base-300 rounded-box grid h-20 place-items-center">content</div>
            </div>
        </div>
    );
};

export default TestPage;