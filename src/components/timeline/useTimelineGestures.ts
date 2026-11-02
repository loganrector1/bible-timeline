import { useEffect, type RefObject } from "react";
import { useStore } from "../../state/store";

const DRAG_THRESHOLD_PX = 5;

export function zoomBy(factor: number) {
  const s = useStore.getState();
  s.setZoom(s.pxPerYear * factor);
}

function panPx(dy: number) {
  const s = useStore.getState();
  s.setYear(s.currentYear + dy / s.pxPerYear);
}

/**
 * Wheel, drag and pinch handling for the virtual timeline. Scrolling moves the
 * shared `currentYear` directly (the cursor stays at the vertical center), and
 * Ctrl+wheel or a two-finger pinch zooms around the cursor.
 */
export function useTimelineGestures(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pointers = new Map<number, number>(); // pointerId -> clientY
    let pinchDistance = 0;
    let traveled = 0;
    let dragged = false;
    let velocity = 0; // px per ms
    let lastMoveTime = 0;
    let inertiaFrame = 0;

    const stopInertia = () => {
      cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopInertia();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      const dy = e.deltaY * unit;
      if (e.ctrlKey || e.metaKey) zoomBy(Math.exp(-Math.max(-50, Math.min(50, dy)) * 0.01));
      else panPx(dy);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopInertia();
      if ((e.target as Element).closest("[data-no-pan]")) return;
      pointers.set(e.pointerId, e.clientY);
      if (pointers.size === 1) {
        traveled = 0;
        dragged = false;
        velocity = 0;
        lastMoveTime = e.timeStamp;
      }
      if (pointers.size === 2) pinchDistance = 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      const prevY = pointers.get(e.pointerId);
      if (prevY === undefined) return;

      if (pointers.size === 2) {
        // Pinch: compare the vertical distance between the two fingers.
        pointers.set(e.pointerId, e.clientY);
        const [a, b] = [...pointers.values()];
        const distance = Math.max(20, Math.abs(a - b));
        if (pinchDistance) zoomBy(distance / pinchDistance);
        pinchDistance = distance;
        dragged = true;
        return;
      }

      const dy = e.clientY - prevY;
      pointers.set(e.pointerId, e.clientY);
      traveled += Math.abs(dy);
      if (!dragged && traveled > DRAG_THRESHOLD_PX) {
        dragged = true;
        el.setPointerCapture(e.pointerId);
      }
      if (!dragged) return;
      panPx(-dy);
      const dt = Math.max(1, e.timeStamp - lastMoveTime);
      velocity = 0.8 * (-dy / dt) + 0.2 * velocity;
      lastMoveTime = e.timeStamp;
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size > 0 || !dragged) return;
      if (e.timeStamp - lastMoveTime > 80) velocity = 0;
      let last = performance.now();
      const glide = (now: number) => {
        const dt = now - last;
        last = now;
        panPx(velocity * dt);
        velocity *= 0.95 ** (dt / 16);
        inertiaFrame = Math.abs(velocity) > 0.02 ? requestAnimationFrame(glide) : 0;
      };
      if (Math.abs(velocity) > 0.05) inertiaFrame = requestAnimationFrame(glide);
    };

    // A drag that ends over a button must not count as a click on it.
    const onClickCapture = (e: MouseEvent) => {
      if (dragged) {
        e.stopPropagation();
        e.preventDefault();
        dragged = false;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      stopInertia();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [ref]);
}
