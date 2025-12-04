import TeaseMeIncomeCalculatorSection from "./sections/TeaseMeIncomeCalculatorSection";
import TeaseMeIncomeSection from "./sections/TeaseMeIncomeSection";
import TeaseMeLanding from "./sections/TeaseMeLanding";
import TeaseMeProcessSection from "./sections/TeaseMeProcessSection";
import TeaseMeVideoSection from "./sections/TeaseMeVideoSection";
import TeaseMeWhySection from "./sections/TeaseMeWhySection";

export default function LandingPage() {
  return (
    <div style={{ overflowY: "auto", overflowX: "hidden" }}>
      <TeaseMeLanding />
      <TeaseMeVideoSection />
      <TeaseMeIncomeSection />
      <TeaseMeWhySection />
      <TeaseMeProcessSection />
      <TeaseMeIncomeCalculatorSection />
    </div>
  );
}
