import { useEffect, useRef, useState } from "react";
import { joystickInput } from "@/game/touch-input";
import type { InputState } from "@/game/types";

export default function TouchJoystick({
  disabled,
  camera,
  onMove,
}: {
  disabled: boolean;
  camera: boolean;
  onMove: (
    direction: Pick<InputState, "up" | "down" | "left" | "right">,
  ) => void;
}) {
  const pointer = useRef<number | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const move = useRef(onMove);
  useEffect(() => {
    move.current = onMove;
  }, [onMove]);
  const clear = () => {
    pointer.current = null;
    setStick({ x: 0, y: 0 });
    move.current(joystickInput(0, 0));
  };
  useEffect(() => {
    const reset = () => {
      pointer.current = null;
      setStick({ x: 0, y: 0 });
      move.current(joystickInput(0, 0));
    };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
      move.current(joystickInput(0, 0));
    };
  }, []);
  return (
    <button
      className="touch-joystick"
      aria-label={
        camera
          ? "Camera joystick. Drag to pan."
          : "Movement joystick. Drag to move."
      }
      disabled={disabled}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const value = joystickInput(
          e.clientX - rect.left - rect.width / 2,
          e.clientY - rect.top - rect.height / 2,
        );
        setStick(value);
        move.current(value);
      }}
      onPointerMove={(e) => {
        if (pointer.current !== e.pointerId || disabled) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const value = joystickInput(
          e.clientX - rect.left - rect.width / 2,
          e.clientY - rect.top - rect.height / 2,
        );
        setStick(value);
        move.current(value);
      }}
      onPointerUp={(e) => {
        if (pointer.current === e.pointerId) clear();
      }}
      onPointerCancel={(e) => {
        if (pointer.current === e.pointerId) clear();
      }}
      onLostPointerCapture={(e) => {
        if (pointer.current === e.pointerId) clear();
      }}
    >
      <span
        aria-hidden="true"
        style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }}
      />
    </button>
  );
}
