import { AuthContext } from "@/context/AuthContext";
import React, { ReactNode, useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import { Paths } from "@/routes/path";

interface PrivateRouteProps {
    children: ReactNode;
}

const GuestRoute: React.FC<PrivateRouteProps> = ({ children }) => {
    const { isSignedIn, loadingAuth } = useContext(AuthContext);
    const location = useLocation();
    const fromPath = (location.state as { from?: string })?.from;

    if (loadingAuth) {
        return (
            <BlockingLoader />
        );
    }

    if (isSignedIn) {
        return <Navigate to={fromPath ?? Paths.home} replace />;
    }

    return <>{children}</>;
};

export default GuestRoute;
