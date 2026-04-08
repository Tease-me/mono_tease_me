import { apiClient } from "@/api/apis";
import { PreInfluencerServices } from "@/api/services/PreInfluencerServices";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import HomeFooter from "./HomeFooter";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import logger from "@/utils/logger";
import SvgPack from "@/utils/SvgPack";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import imageHPHero from "@/assets/image/creator-collage.jpg";
import imageTeaseMeLight from "@/assets/image/iconTeaseMeLight.png";

import { Paths } from "@/routes/path";
import "./LandingPage.css";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  //const { isSignedIn } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasInfluencer, setHasInfluencer] = useState<boolean | null>(null);

  const preInfluencerServices = PreInfluencerServices(apiClient);
  const influencerRepo = InfluencerRepo();

  useEffect(() => {
    const checkInfluencerStatus = async () => {
      try {
        // Check if user has influencer account
        const preInfluencer = await preInfluencerServices.getMe();
        if (preInfluencer) {
          setHasInfluencer(true);
          // Check if user has an active influencer profile
          // For now, we'll check if they have an influencer ID
          // You can adjust this logic based on your API response structure
          if (preInfluencer.id) {
            // User has influencer account - navigate to InfluencerHome
            navigate(Paths.influencerHome);
          } else {
            // User has intention to be influencer - navigate to IntencionInfluencerHome
            navigate(Paths.intencionInfluencerHome);
          }
          return;
        }
        setHasInfluencer(false);
      } catch (error) {
        logger.error("Error checking influencer status:", error);
        setHasInfluencer(false);
      } finally {
        setLoading(false);
      }
    };

    checkInfluencerStatus();
  }, [navigate]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      // Try to find influencer by username
      const influencer = await influencerRepo.getInfluencer("");
      if (influencer) {
        navigate(Paths.influencerHome);
      } else {
        // If not found, navigate to IntencionInfluencerHome
        navigate(Paths.intencionInfluencerHome);
      }
    } catch (error) {
      logger.error("Error searching influencer:", error);
      // On error, navigate to IntencionInfluencerHome
      navigate(Paths.intencionInfluencerHome);
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return <BlockingLoader />;
  }

  if (hasInfluencer) {
    // This should not render if navigation happens, but just in case
    return null;
  }

  return (
    <div className="home-page">
      {/* Background Image */}

      {/* Header with Logo */}
      <header className="home-page-header">
        <TeaseMeLogo variant="full-dark" size="medium" />
      </header>

      {/* Main Content */}
      <div className="home-page-hero-content">
        <div className="hp-inner-container">
          <div className="hp-hero-col01">
            <h1 className="home-page-title">
              Is your{" "}
              <span className="home-page-title-highlight">
                {" "}
                favourite influencer{" "}
              </span>{" "}
              on TeaseMe? 
            </h1>
            <p className="home-page-subtitle">
              Coming in 2026: <strong>Creator Discovery!</strong> <br></br>
              Search for creators and see if they have their own TeaseMe
              account.
            </p>
          </div>
        </div>
        <img src={imageHPHero} alt="" className="hp-hero-image" />
      </div>

      {/* Search Section */}
      <div className="home-page-search-section">
        <div className="home-page-search-container">
          <div className="home-page-logo-decoration">
            <img
              src={imageTeaseMeLight}
              alt=""
              className="home-page-logo-icon"
            />
          </div>

          <div className="home-page-input-wrapper">
            <div className="ps-field">
              <label className="home-ps-label">
                Search launching early 2026{" "}
                <span className="ps-required"></span>
              </label>
              <div className="home-page-input-outer">
                <input
                  className="home-page-ps-input"
                  placeholder="Enter Instagram Account"
                />
              </div>
            </div>
          </div>
          <div className="hp-search-button-container">
            <PrimaryButton
              text="Search"
              rightIcon={<SvgPack.ArrowRight />}
              onClick={handleSearch}
              disabled={searching}
              className="home-page-search-button"
            />
          </div>
        </div>
      </div>
      <HomeFooter></HomeFooter>
    </div>
  );
};

export default LandingPage;
