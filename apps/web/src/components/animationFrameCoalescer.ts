export interface AnimationFrameCoalescer<T> {
  readonly cancel: () => void;
  readonly flush: () => void;
  readonly schedule: (value: T) => void;
}

/**
 * Keeps only the newest value scheduled before the next animation frame.
 * `flush` is useful at interaction boundaries where the final sampled value
 * must be applied before a pointer-up commit.
 */
export function createAnimationFrameCoalescer<T>({
  cancelFrame,
  onFrame,
  requestFrame
}: {
  readonly cancelFrame: (frameId: number) => void;
  readonly onFrame: (value: T) => void;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
}): AnimationFrameCoalescer<T> {
  let frameId: number | undefined;
  let hasPendingValue = false;
  let pendingValue: T;

  const deliver = () => {
    frameId = undefined;

    if (!hasPendingValue) {
      return;
    }

    const value = pendingValue;
    hasPendingValue = false;
    onFrame(value);
  };

  return {
    cancel() {
      if (frameId !== undefined) {
        cancelFrame(frameId);
        frameId = undefined;
      }
      hasPendingValue = false;
    },
    flush() {
      if (frameId !== undefined) {
        cancelFrame(frameId);
      }
      deliver();
    },
    schedule(value) {
      pendingValue = value;
      hasPendingValue = true;

      if (frameId === undefined) {
        frameId = requestFrame(deliver);
      }
    }
  };
}

export function getViewportBackingPixelRatio(devicePixelRatio: number): number {
  return Math.min(
    2,
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1
  );
}

export function shouldNotifyViewportHover(
  previousRenderId: string | undefined,
  nextRenderId: string | undefined,
  notifyPointChanges: boolean
): boolean {
  return notifyPointChanges || previousRenderId !== nextRenderId;
}
