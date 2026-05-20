import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import type { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import type { CallStatus } from "@/hooks/useCallWebRTC";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { showErrorModal } from "@/utils/errorModal";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

let followedInfluencersCache: InfluencerDataModel[] | null = null;
let followedInfluencersInFlight: Promise<InfluencerDataModel[]> | null = null;
let followedInfluencersCacheGeneration = 0;

export const invalidateFollowedInfluencersCache = () => {
  followedInfluencersCache = null;
  followedInfluencersInFlight = null;
  followedInfluencersCacheGeneration++;
};

const influencerRepo = InfluencerRepo();

const getFollowedInfluencersCached = async () => {
  if (followedInfluencersCache) {
    return followedInfluencersCache;
  }
  if (followedInfluencersInFlight) {
    return followedInfluencersInFlight;
  }
  const generation = followedInfluencersCacheGeneration;
  followedInfluencersInFlight = influencerRepo
    .getFollowedInfluencers()
    .then((list: InfluencerDataModel[]) => {
      if (followedInfluencersCacheGeneration === generation) {
        followedInfluencersCache = list;
      }
      return list;
    })
    .finally(() => {
      followedInfluencersInFlight = null;
    });
  return followedInfluencersInFlight;
};

export function useInfluencerSelection(
  callStatus: CallStatus,
  defaultInfluencerId?: string,
) {
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    const stored = storage.get(LocalStorageKeys.SelectedId);
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
      try {
        const localInfluencer = await influencerRepo.getInfluencer(selectedId);
        if (isMounted) {
          setInfluencer(localInfluencer);
        }
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (isMounted && (status === 404 || status === 410)) {
          setInfluencer(undefined);
          storage.set(LocalStorageKeys.SelectedId, "");
          setSelectedId(undefined);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [selectedId]);

  useEffect(() => {
    storage.set(LocalStorageKeys.SelectedId, selectedId?.toString() || "");
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
    }).catch(() => {
      if (!isMounted) return;
      setNeedsSelection(false);
      setHasMultipleInfluencers(false);
      setInfluencers([]);
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
    if (callStatus === "connected" || callStatus === "connecting") {
      showErrorModal({
        title: "Active Call in Progress",
        message: "End the call before switching influencer.",
      });
      return;
    }
    setSelectedId(undefined);
    setNeedsSelection(true);
  }, [callStatus]);

  const isSelectingInfluencer = useMemo(
    () => needsSelection && !selectedId,
    [needsSelection, selectedId],
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
