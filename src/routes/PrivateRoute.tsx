import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { AuthContext } from "@/context/AuthContext";
import React, { ReactNode, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isSignedIn, loadingAuth } = useContext(AuthContext);

  if (loadingAuth) {
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
