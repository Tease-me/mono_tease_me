import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import type { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

let followedInfluencersCache: InfluencerDataModel[] | null = null;
let followedInfluencersInFlight: Promise<InfluencerDataModel[]> | null = null;

const influencerRepo = InfluencerRepo();

const getFollowedInfluencersCached = async () => {
  if (followedInfluencersCache) {
    return followedInfluencersCache;
  }
  if (followedInfluencersInFlight) {
    return followedInfluencersInFlight;
  }
  followedInfluencersInFlight = influencerRepo
    .getFollowedInfluencers()
    .then((list: InfluencerDataModel[]) => {
      followedInfluencersCache = list;
      return list;
    })
    .finally(() => {
      followedInfluencersInFlight = null;
    });
  return followedInfluencersInFlight;
};

export function useInfluencerSelection(defaultInfluencerId?: string) {
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    const stored = localStorage.getItem("selected_id");
    return stored || undefined;
  });
  const [needsSelection, setNeedsSelection] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [hasMultipleInfluencers, setHasMultipleInfluencers] = useState(false);
  const [influencer, setInfluencer] = useState<InfluencerDataModel>();

  const skipInfluencerResetRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!selectedId) {
        if (isMounted) setInfluencer(undefined);
        return;
      }
      const localInfluencer = await influencerRepo.getInfluencer(selectedId);
      if (isMounted) {
        setInfluencer(localInfluencer);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [selectedId]);

  useEffect(() => {
    localStorage.setItem("selected_id", selectedId?.toString() || "");
  }, [selectedId]);

  useEffect(() => {
    let isMounted = true;
    getFollowedInfluencersCached().then((list) => {
      if (!isMounted) return;
      if (!skipInfluencerResetRef.current) {
        if (list.length > 1 && !selectedId) {
          setNeedsSelection(true);
        } else if (list.length === 1) {
          setSelectedId(list[0].id);
        }
      }
      setHasMultipleInfluencers(list.length > 1);
      setInfluencers(list);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (defaultInfluencerId) {
      skipInfluencerResetRef.current = true;
      setSelectedId(defaultInfluencerId);
      setNeedsSelection(false);
    }
  }, [defaultInfluencerId]);

  const handleSelect = useCallback((id: string) => {
    skipInfluencerResetRef.current = true;
    setSelectedId(id);
    setNeedsSelection(false);
  }, []);

  const handleChangeInfluencerClicked = useCallback(() => {
    setSelectedId(undefined);
    setNeedsSelection(true);
  }, []);

  const isSelectingInfluencer = useMemo(
    () => needsSelection && !selectedId,
    [needsSelection, selectedId]
  );

  return {
    influencer,
    influencers,
    hasMultipleInfluencers,
    isSelectingInfluencer,
    handleSelect,
    handleChangeInfluencerClicked,
  };
}
