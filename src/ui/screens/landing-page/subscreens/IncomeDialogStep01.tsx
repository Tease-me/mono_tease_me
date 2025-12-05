import React from "react";
import TeaseMeIncomeCalculator from "../sections/TeaseMeIncomeCalculator";
import "./IncomeDialogStep01.css";

const IncomeDialogStep01: React.FC = () => {
  return (
    <div className="dialog-screen">
      <div className="dialog-frame">
        <TeaseMeIncomeCalculator />
      </div>
    </div>
  );
};

export default IncomeDialogStep01;
