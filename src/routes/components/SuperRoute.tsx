import { AuthContext } from "@/context/AuthContext";
import React, { ReactNode, useContext } from "react";
import { Navigate } from "react-router-dom";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";

interface SuperRouteProps {
    children: ReactNode;
}

const SuperRoute: React.FC<SuperRouteProps> = ({ children }) => {
    const { isSignedIn, loadingAuth, user } = useContext(AuthContext);

    if (loadingAuth) {
        return (
            <BlockingLoader />
        );
    }

    if (!isSignedIn || user !== undefined && user.id !== 1) {
        return <Navigate to="/home" />;
    }

    return <>{children}</>;
};

export default SuperRoute;
