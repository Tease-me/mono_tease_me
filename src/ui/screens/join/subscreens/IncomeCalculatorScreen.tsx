import React from "react";
import TeaseMeIncomeCalculator from "../sections/TeaseMeIncomeCalculator";
import "./IncomeCalculatorScreen.css";

const IncomeCalculatorScreen: React.FC = () => {
  return (
    <div className="dialog-screen">
      <div className="dialog-frame">
        <TeaseMeIncomeCalculator />
      </div>
    </div>
  );
};

export default IncomeCalculatorScreen;
