import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import styles from "./SceneSwipeDeck.module.css";

const SWIPE_COMMIT_PX = 36;
const SWIPE_VELOCITY = 0.2;
const EXIT_MS = 340;
const UNDER_SCALE_REST = 0.94;
const BUTTON_CLEARANCE_PX = 76;
const EASE_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";

type DepartingCard<T> = {
  item: T;
  x: number;
  direction: 1 | -1;
  animate: boolean;
};

type EnteringCard<T> = {
  item: T;
  x: number;
  animate: boolean;
};

type SceneSwipeDeckProps<T> = {
  items: T[];
  index: number;
  onIndexChange: (index: number) => void;
  renderCard: (item: T) => ReactNode;
  renderUnderCard?: (item: T) => ReactNode;
  deckRef?: RefObject<HTMLDivElement | null>;
};

export default function SceneSwipeDeck<T>({
  items,
  index,
  onIndexChange,
  renderCard,
  renderUnderCard,
  deckRef,
}: SceneSwipeDeckProps<T>) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [departing, setDeparting] = useState<DepartingCard<T> | null>(null);
  const [entering, setEntering] = useState<EnteringCard<T> | null>(null);
  const [promoteUnder, setPromoteUnder] = useState(false);

  const swipeSurfaceRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const startTimeRef = useRef(0);
  const dragXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isLockedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const indexRef = useRef(index);
  const itemsLengthRef = useRef(items.length);
  const onIndexChangeRef = useRef(onIndexChange);
  const itemsRef = useRef(items);

  indexRef.current = index;
  itemsLengthRef.current = items.length;
  itemsRef.current = items;
  onIndexChangeRef.current = onIndexChange;

  const current = items[index];
  const next = items[index + 1];
  const canGoNext = index < items.length - 1;
  const canGoPrev = index > 0;

  const isAnimating = departing != null || entering != null;
  const hideTopCard = departing?.direction === 1 || entering != null;

  const forwardDragProgress =
    dragX < 0 && canGoNext ? Math.min(Math.abs(dragX) / SWIPE_COMMIT_PX, 1) : 0;

  const underScale = promoteUnder
    ? 1
    : UNDER_SCALE_REST + forwardDragProgress * (1 - UNDER_SCALE_REST);

  const underOffsetX = promoteUnder ? 0 : 8 * (1 - forwardDragProgress);
  const underOffsetY = promoteUnder ? 0 : 6 * (1 - forwardDragProgress);

  const clearExitTimer = () => {
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };

  const finishTransition = (nextIndex: number) => {
    onIndexChangeRef.current(nextIndex);
    setDeparting(null);
    setEntering(null);
    setPromoteUnder(false);
    isLockedRef.current = false;
    exitTimerRef.current = null;
  };

  const startExit = (item: T, fromX: number, direction: 1 | -1) => {
    clearExitTimer();
    isLockedRef.current = true;

    setDeparting({ item, x: fromX, direction, animate: false });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDeparting((state) =>
          state
            ? {
                ...state,
                x: direction === 1 ? -window.innerWidth * 1.05 : window.innerWidth * 1.05,
                animate: true,
              }
            : null,
        );
      });
    });
  };

  const startEnter = (item: T) => {
    setEntering({ item, x: -window.innerWidth * 0.22, animate: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEntering((state) => (state ? { ...state, x: 0, animate: true } : null));
      });
    });
  };

  useEffect(() => () => clearExitTimer(), []);

  useEffect(() => {
    const surface = swipeSurfaceRef.current;
    if (!surface) {
      return;
    }

    const snapBack = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      dragXRef.current = 0;
      setDragX(0);
    };

    const commitNext = () => {
      const currentIndex = indexRef.current;
      const item = itemsRef.current[currentIndex];
      if (!item || currentIndex >= itemsLengthRef.current - 1) {
        snapBack();
        return;
      }

      const fromX = dragXRef.current;
      isDraggingRef.current = false;
      setIsDragging(false);
      dragXRef.current = 0;
      setDragX(0);

      setPromoteUnder(true);
      startExit(item, fromX, 1);

      exitTimerRef.current = window.setTimeout(() => {
        finishTransition(currentIndex + 1);
      }, EXIT_MS);
    };

    const commitPrev = () => {
      const currentIndex = indexRef.current;
      const item = itemsRef.current[currentIndex];
      const prevItem = itemsRef.current[currentIndex - 1];
      if (!item || !prevItem || currentIndex <= 0) {
        snapBack();
        return;
      }

      const fromX = dragXRef.current;
      isDraggingRef.current = false;
      setIsDragging(false);
      dragXRef.current = 0;
      setDragX(0);

      startExit(item, fromX, -1);
      startEnter(prevItem);

      exitTimerRef.current = window.setTimeout(() => {
        finishTransition(currentIndex - 1);
      }, EXIT_MS);
    };

    const resolveDrag = () => {
      if (!isDraggingRef.current || isLockedRef.current) {
        return;
      }

      const offset = dragXRef.current;
      const elapsed = Math.max(Date.now() - startTimeRef.current, 1);
      const velocity = Math.abs(offset) / elapsed;

      const currentIndex = indexRef.current;
      const length = itemsLengthRef.current;
      const hasNext = currentIndex < length - 1;
      const hasPrev = currentIndex > 0;

      const shouldCommitNext =
        hasNext &&
        (offset < -SWIPE_COMMIT_PX || (offset < -12 && velocity > SWIPE_VELOCITY));
      const shouldCommitPrev =
        hasPrev &&
        (offset > SWIPE_COMMIT_PX || (offset > 12 && velocity > SWIPE_VELOCITY));

      if (shouldCommitNext) {
        commitNext();
        return;
      }
      if (shouldCommitPrev) {
        commitPrev();
        return;
      }

      snapBack();
    };

    const beginDrag = (clientX: number) => {
      if (isLockedRef.current) {
        return false;
      }

      clearExitTimer();
      startXRef.current = clientX;
      startTimeRef.current = Date.now();
      isDraggingRef.current = true;
      setIsDragging(true);
      return true;
    };

    const moveDrag = (clientX: number) => {
      if (!isDraggingRef.current || isLockedRef.current) {
        return;
      }

      const currentIndex = indexRef.current;
      const length = itemsLengthRef.current;
      const hasNext = currentIndex < length - 1;
      const hasPrev = currentIndex > 0;

      let nextX = clientX - startXRef.current;
      if (nextX > 0 && !hasPrev) {
        nextX *= 0.18;
      }
      if (nextX < 0 && !hasNext) {
        nextX *= 0.18;
      }

      dragXRef.current = nextX;
      setDragX(nextX);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !surface.contains(event.target as Node)) {
        return;
      }
      beginDrag(event.touches[0].clientX);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!isDraggingRef.current || event.touches.length !== 1) {
        return;
      }
      event.preventDefault();
      moveDrag(event.touches[0].clientX);
    };

    const onTouchEnd = () => {
      if (!isDraggingRef.current) {
        return;
      }
      resolveDrag();
    };

    const onTouchCancel = () => {
      if (!isDraggingRef.current) {
        return;
      }
      resolveDrag();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !surface.contains(event.target as Node)) {
        return;
      }
      if (beginDrag(event.clientX)) {
        surface.setPointerCapture(event.pointerId);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current || event.pointerType === "touch") {
        return;
      }
      moveDrag(event.clientX);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!isDraggingRef.current || event.pointerType === "touch") {
        return;
      }
      resolveDrag();
    };

    surface.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true, capture: true });
    surface.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      surface.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", onTouchCancel, true);
      surface.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  if (!current) {
    return null;
  }

  const isActiveDrag = isDragging && !isAnimating;
  const motionMs = EXIT_MS;
  const motionTransition = isActiveDrag ? "none" : `transform ${motionMs}ms ${EASE_OUT}`;

  const cardTransform = (x: number) => {
    const rotate = x * 0.028;
    return `translateX(${x}px) rotate(${rotate}deg)`;
  };

  const underTransform = `translate(${underOffsetX}px, ${underOffsetY}px) scale(${underScale})`;
  const renderUnder = renderUnderCard ?? renderCard;

  return (
    <div ref={deckRef} className={styles.deck}>
      <div className={`${styles.stack}${canGoNext ? ` ${styles.stackHasMore}` : ""}`}>
        {next ? (
          <div
            className={styles.underCard}
            style={{ transform: underTransform, transition: motionTransition }}
          >
            {renderUnder(next)}
          </div>
        ) : null}

        <div
          className={`${styles.topCard}${isActiveDrag ? ` ${styles.topCardDragging}` : ""}${hideTopCard ? ` ${styles.topCardHidden}` : ""}`}
          style={{
            transform: cardTransform(dragX),
            transition: motionTransition,
          }}
        >
          {dragX < -12 && canGoNext && !isAnimating ? (
            <span
              className={styles.swipeHintNext}
              style={{ opacity: forwardDragProgress }}
            >
              NEXT
            </span>
          ) : null}
          {dragX > 12 && canGoPrev && !isAnimating ? (
            <span
              className={styles.swipeHintPrev}
              style={{ opacity: Math.min(Math.abs(dragX) / SWIPE_COMMIT_PX, 1) }}
            >
              BACK
            </span>
          ) : null}
          {renderCard(current)}
          <div
            ref={swipeSurfaceRef}
            className={styles.swipeSurface}
            style={{ bottom: BUTTON_CLEARANCE_PX }}
            aria-hidden="true"
          />
        </div>

        {entering ? (
          <div
            className={styles.enteringCard}
            style={{
              transform: cardTransform(entering.x),
              transition: entering.animate ? `transform ${motionMs}ms ${EASE_OUT}` : "none",
            }}
          >
            {renderCard(entering.item)}
          </div>
        ) : null}

        {departing ? (
          <div
            className={styles.departingCard}
            style={{
              transform: cardTransform(departing.x),
              transition: departing.animate ? `transform ${motionMs}ms ${EASE_OUT}` : "none",
            }}
          >
            {renderCard(departing.item)}
          </div>
        ) : null}
      </div>

      <div className={styles.footer}>
        <div className={styles.dots} aria-hidden="true">
          {items.map((_, dotIndex) => (
            <span
              key={dotIndex}
              className={dotIndex === index ? styles.dotActive : styles.dot}
            />
          ))}
        </div>
        <span className={styles.counter}>
          {index + 1} / {items.length}
        </span>
        <span className={styles.hint}>Swipe left or right to browse</span>
      </div>
    </div>
  );
}
