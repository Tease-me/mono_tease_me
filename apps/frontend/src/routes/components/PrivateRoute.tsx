import { AuthContext } from "@/context/AuthContext";
import React, { ReactNode, useContext } from "react";
import { Navigate } from "react-router-dom";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import { Paths } from "@/routes/path";

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isSignedIn, loadingAuth } = useContext(AuthContext);

  if (loadingAuth) {
    return (
      <BlockingLoader />
    );
  }

  if (!isSignedIn) {
    return <Navigate to={Paths.login} />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
