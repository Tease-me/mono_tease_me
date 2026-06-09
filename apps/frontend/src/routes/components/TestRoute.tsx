import { SHOW_TEST_ROUTES } from "@/env";
import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Paths } from "@/routes/path";

interface TestRouteProps {
  children: ReactNode;
}

const TestRoute: React.FC<TestRouteProps> = ({ children }) => {
  if (!SHOW_TEST_ROUTES) {
    return <Navigate to={Paths.all} replace />;
  }

  return <>{children}</>;
};

export default TestRoute;
