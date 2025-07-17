import LoadingSpinner from "@/components/loading/LoadingSpinner";
import { AuthContext } from "@/context/AuthContext";
import React, { ReactNode, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isSignedIn, loadingAuth } = useContext(AuthContext);
  const [delayedLoading, setDelayedLoading] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDelayedLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (delayedLoading || loadingAuth) {
    return (
      <LoadingSpinner />
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
