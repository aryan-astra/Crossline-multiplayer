"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AREAS, type AreaId } from "@/game/locations";
import type { MapId, Role } from "@/game/types";
import type { Profile } from "@/network/protocol";
import "./menu.css";
import { CITY_NAMES, placeName } from "@/game/place-names";

const GameScreen = dynamic(() => import("@/components/GameScreen"), {
  loading: () => (
    <main className="game-lobby">
      <section className="lobby-intro">
        <h1>Crossline</h1>
        <p role="status">Loading the city…</p>
      </section>
    </main>
  ),
});

const cities = [
  {
    id: "delhi" as const,
    name: CITY_NAMES.delhi,
    area: "Mantar Jantar",
    image: "/img/crossline-delhi.png",
    description:
      "Sandstone observatories. Narrow streets. A gathering finding its voice.",
  },
  {
    id: "paris" as const,
    name: CITY_NAMES.paris,
    area: "Republic quarter",
    image: "/img/crossline-paris.png",
    description: "Broad boulevards. Café lights. All eyes on the square.",
  },
];
const roles: {
  id: Role;
  name: string;
  description: string;
  control: string;
}[] = [
  {
    id: "protester",
    name: "Protester",
    description: "Join the crowd. Chant, gather supplies and hold the square.",
    control: "E to chant · F to interact",
  },
  {
    id: "police",
    name: "Police",
    description:
      "Lead your formation. Protect the square and detain active threats.",
    control: "E to detain · C to command",
  },
  {
    id: "watcher",
    name: "Spectator",
    description: "Watch freely. Trade the virtual market and fund deliveries.",
    control: "Free camera · Markets & supplies",
  },
  {
    id: "military",
    name: "Military",
    description: "Earn a temporary appointment through police performance.",
    control: "Appointment required",
  },
];
const steps = ["Your city", "Your side"];
const headings = ["Make your entrance.", "Choose your side."];
const descriptions = [
  "A callsign. A city. Your story starts here.",
  "Pick a role and an entry point. Saved characters resume in place.",
];

export default function Home() {
  const [mapId, setMapId] = useState<MapId>("delhi");
  const [areaId, setAreaId] = useState<AreaId>("gathering");
  const [role, setRole] = useState<Role>("protester");
  const [name, setName] = useState("");
  const [step, setStep] = useState(-1);
  const [guide, setGuide] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [serverMode, setServerMode] = useState<"lan" | "online" | null>(null);
  const [onlineUrl, setOnlineUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);
    fetch("/api/connection", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Server mode unavailable");
        return r.json();
      })
      .then((data) => {
        if (active && ["lan", "online"].includes(data.mode)) {
          setServerMode(data.mode);
          setOnlineUrl(data.onlineUrl ?? null);
        }
      })
      .catch(() => {
        if (active) setServerMode(null);
      });
    fetch("/api/session", { cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Connection unavailable");
        const data = (await response.json()) as { profile: Profile };
        if (active && !abort.signal.aborted) {
          setProfile(data.profile);
          setName(
            (current) =>
              current ||
              (data.profile.name === "Guest" ? "" : data.profile.name),
          );
          setConnection("ready");
        }
      })
      .catch(() => {
        if (active) setConnection("error");
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      abort.abort();
    };
  }, [attempt, playing]);

  useEffect(() => {
    if (step >= 0 || guide) heading.current?.focus();
  }, [step, guide]);

  const advance = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setStep(0);
      setError("Use a callsign with 2–24 characters.");
      nameInput.current?.focus();
      return;
    }
    setError("");
    if (step < 1) setStep(step + 1);
    else if (!profile || connection !== "ready")
      setError(
        "The server is unavailable. Use Retry connection below, then try again.",
      );
    else setPlaying(true);
  };
  const openSetup = () => {
    setGuide(false);
    setStep((current) => Math.max(0, current));
    setError("");
  };
  const city = cities.find((item) => item.id === mapId)!;
  const selectedRole = roles.find((item) => item.id === role)!;
  const panelOpen = step >= 0 || guide;

  if (playing)
    return (
      <GameScreen
        mapId={mapId}
        areaId={areaId}
        role={role}
        name={name.trim()}
        onExit={() => {
          setPlaying(false);
          setStep(1);
        }}
      />
    );

  return (
    <main className={`game-lobby ${panelOpen ? "setup-open" : ""}`}>
      <Image
        className="lobby-art"
        src="/img/crossline-title-v2.png"
        alt=""
        fill
        priority
        sizes="100vw"
      />
      <div className="lobby-shade" />
      <header className="lobby-header">
        <Link
          href="/"
          className="lobby-brand"
          aria-label="Crossline title screen"
        >
          <Image
            src="/brand/crossline-mark.svg"
            width={32}
            height={32}
            alt=""
          />{" "}
          CROSSLINE
        </Link>
        <nav aria-label="Game menu">
          <button
            className="lobby-nav"
            aria-current={guide ? "page" : undefined}
            onClick={() => setGuide(true)}
          >
            Controls
          </button>
        </nav>
      </header>
      <div className="lobby-main">
        <section className="lobby-intro" aria-labelledby="game-title">
          <p className="lobby-kicker">A city in the balance</p>
          <h1 id="game-title">CROSSLINE</h1>
          <span className="lobby-subtitle">CROWD COMMAND</span>
          <p className="lobby-description">Hold the line. Break the silence.</p>
          {!panelOpen && (
            <div className="lobby-actions">
              <button
                className="lobby-primary"
                disabled={serverMode !== "lan"}
                onClick={openSetup}
              >
                Local network <span aria-hidden="true">→</span>
              </button>
              <small className="mode-help">
                {serverMode === "lan"
                  ? "Same Wi-Fi · This host stays running"
                  : "Open your local host’s address for Wi-Fi play"}
              </small>
              <button
                className="lobby-secondary"
                disabled={
                  !serverMode || (serverMode !== "online" && !onlineUrl)
                }
                onClick={() => {
                  if (serverMode === "online") openSetup();
                  else if (onlineUrl) window.location.assign(onlineUrl);
                }}
              >
                Online <span aria-hidden="true">↗</span>
              </button>
              <small className="mode-help">
                {serverMode === "online" || onlineUrl
                  ? "Public server · Players from anywhere"
                  : "Public server not configured"}
              </small>
              <button className="lobby-nav" onClick={() => setGuide(true)}>
                How to play
              </button>
            </div>
          )}
          <p className="lobby-credit">
            Multiplayer crowd simulation · Fictional events
          </p>
        </section>
        {guide ? (
          <section className="setup-pane" aria-labelledby="setup-heading">
            <div className="setup-content">
              <p className="lobby-kicker">Field guide</p>
              <h2 id="setup-heading" ref={heading} tabIndex={-1}>
                The city keeps moving.
              </h2>
              <p className="setup-description">
                Your controls change with your role. The server owns the shared
                world; settings pause your input, not the city.
              </p>
              <dl className="guide-controls">
                <dt>WASD / arrows</dt>
                <dd>
                  Move. Hold Shift to run. Touch controls appear on small
                  screens.
                </dd>
                <dt>E / Space</dt>
                <dd>
                  Chant as a protester. Detain an active threat as police.
                </dd>
                <dt>F / B</dt>
                <dd>
                  Collect essentials or interact with the objective. Enter or
                  leave near a doorway.
                </dd>
                <dt>Spectator</dt>
                <dd>
                  Pan and zoom freely. Open Markets & supplies to trade, predict
                  outcomes or fund a delivery.
                </dd>
                <dt>Military</dt>
                <dd>
                  Earn an appointment through police performance. A warning and
                  an immediate serious threat are required to engage.
                </dd>
              </dl>
              <p className="setup-note">
                All money is fictional credit. Progress is tied to this
                browser’s guest identity. Buildings use OpenStreetMap
                footprints; art, interiors and events are illustrative.
              </p>
            </div>
            <div className="setup-bottom">
              <button
                className="lobby-secondary"
                onClick={() => setGuide(false)}
              >
                Back
              </button>
              <button className="lobby-primary" onClick={openSetup}>
                Choose your side →
              </button>
            </div>
          </section>
        ) : step >= 0 ? (
          <form
            className="setup-pane"
            onSubmit={advance}
            noValidate
            aria-labelledby="setup-heading"
          >
            <ol className="setup-progress" aria-label="Player setup progress">
              {steps.map((label, index) => (
                <li
                  key={label}
                  aria-current={index === step ? "step" : undefined}
                >
                  {index + 1}. {label}
                </li>
              ))}
            </ol>
            <div className="setup-content" key={step}>
              <h2 id="setup-heading" ref={heading} tabIndex={-1}>
                {headings[step]}
              </h2>
              <p className="setup-description">{descriptions[step]}</p>
              {step === 0 && (
                <>
                  <label className="lobby-field-label" htmlFor="callsign">
                    Callsign
                  </label>
                  <input
                    className="lobby-name"
                    ref={nameInput}
                    id="callsign"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (error) setError("");
                    }}
                    minLength={2}
                    maxLength={24}
                    required
                    autoComplete="nickname"
                    placeholder="What should we call you?"
                    aria-describedby="name-help setup-error"
                    aria-invalid={!!error}
                  />
                  <p className="setup-note" id="name-help">
                    2–24 characters. Your guest profile is saved in this
                    browser.
                  </p>
                </>
              )}
              {step === 0 && (
                <fieldset>
                  <legend>City</legend>
                  <div className="setup-options">
                    {cities.map((item) => (
                      <label className="setup-choice" key={item.id}>
                        <input
                          type="radio"
                          name="city"
                          value={item.id}
                          checked={mapId === item.id}
                          onChange={() => {
                            setMapId(item.id);
                            setAreaId("gathering");
                          }}
                        />
                        <span className="choice-thumb">
                          <Image src={item.image} alt="" fill sizes="80px" />
                        </span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.area}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="setup-note">{city.description}</p>
                </fieldset>
              )}
              {step === 1 && (
                <fieldset>
                  <legend>Entry area</legend>
                  <div className="setup-options area-options">
                    {AREAS[mapId].map((item) => (
                      <label className="setup-choice" key={item.id}>
                        <input
                          type="radio"
                          name="area"
                          value={item.id}
                          checked={areaId === item.id}
                          onChange={() => setAreaId(item.id)}
                        />
                        <span>
                          <strong>{placeName(item.name)}</strong>
                          <small>
                            {item.id === "gathering"
                              ? "Near the gathering"
                              : "Enter from the outer streets"}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {step === 1 && (
                <>
                  <fieldset>
                    <legend>Role</legend>
                    <div className="setup-options role-options">
                      {roles.map((item) => (
                        <label className="setup-choice" key={item.id}>
                          <input
                            type="radio"
                            name="role"
                            aria-label={`${item.name}. ${item.control}`}
                            value={item.id}
                            checked={role === item.id}
                            disabled={
                              item.id === "military" &&
                              !profile?.appointmentUntil
                            }
                            onChange={() => setRole(item.id)}
                          />
                          <span className="role-portrait">
                            <Image
                              src={`/img/crossline-${item.id}.png`}
                              alt=""
                              fill
                              sizes="44px"
                            />
                          </span>
                          <span>
                            <strong>{item.name}</strong>
                            {item.id === "military" &&
                              !profile?.appointmentUntil && (
                                <small>Locked</small>
                              )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <p className="setup-note">{selectedRole.description}</p>
                </>
              )}
              <p className="setup-error" id="setup-error" role="status">
                {error}
              </p>
            </div>
            <div className="setup-bottom">
              <button
                type="button"
                className="lobby-secondary"
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                Back
              </button>
              <button className="lobby-primary" type="submit">
                {step === 1 ? "Enter the city" : "Choose role"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="lobby-scene-caption">
            <strong>One city. Every choice matters.</strong>
            <span>
              {CITY_NAMES.delhi} / {CITY_NAMES.paris}
            </span>
          </div>
        )}
      </div>
      <footer className="lobby-footer">
        <span className="lobby-server" data-state={connection} role="status">
          {connection === "ready"
            ? "Server connected"
            : connection === "loading"
              ? "Connecting to the city…"
              : "Server unavailable"}
          {connection === "error" && (
            <button
              onClick={() => {
                setConnection("loading");
                setAttempt((value) => value + 1);
              }}
            >
              Retry connection
            </button>
          )}
        </span>
        <span>
          {profile
            ? `${profile.credits} virtual credits · Guest profile`
            : "No account required"}
        </span>
      </footer>
    </main>
  );
}
