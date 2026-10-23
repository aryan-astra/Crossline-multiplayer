"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import GameScreen from "@/components/GameScreen";
import type { MapId, Role } from "@/game/types";
import type { Profile } from "@/network/protocol";
import "./menu.css";

const locations = [
  {
    id: "delhi" as const,
    name: "Mantar Jantar",
    landmark: "Fictional Delhi inspired observatory",
    image: "/img/crossline-delhi.png",
    atmosphere: "Warm. Dusty. Restless.",
    description:
      "Red sandstone sundials, walled gardens and narrow gates. A gathering finds its voice in the observatory quarter.",
    color: "#f6a45f",
  },
  {
    id: "paris" as const,
    name: "Paris · Republica Plaza",
    landmark: "République / Paris inspired",
    image: "/img/crossline-paris.png",
    atmosphere: "Blue hour. All eyes on the square.",
    description:
      "Café lights, broad boulevards and a monument above the crowd. An open square with nowhere to hide.",
    color: "#8bbde9",
  },
];
const roles = [
  {
    id: "protester" as const,
    name: "Protester",
    image: "/img/crossline-protester.png",
    color: "#f2a064",
    tag: "Hold your ground",
    description:
      "March with the crowd. Raise morale, collect supplies and decide how far you are willing to go.",
    control: "E to chant",
  },
  {
    id: "police" as const,
    name: "Police",
    image: "/img/crossline-police.png",
    color: "#83b7f0",
    tag: "Hold the line",
    description:
      "Command a formation, respond to violent actors and bring suspects into custody.",
    control: "E to detain · C to command",
  },
  {
    id: "military" as const,
    name: "Military",
    image: "/img/crossline-military.png",
    color: "#b2c184",
    tag: "Know your limits",
    description:
      "Watch the perimeter. Warn first. Strict engagement rules apply to you and every military bot.",
    control: "Q to warn · E to engage",
  },
  {
    id: "watcher" as const,
    name: "Spectator",
    image: "/img/crossline-watcher.png",
    color: "#c4a4e6",
    tag: "Read the city",
    description:
      "See the bigger picture. Trade the fictional market, predict outcomes and send in supplies.",
    control: "Free camera · Markets & supplies",
  },
];

export default function Home() {
  const [mapId, setMapId] = useState<MapId>("delhi");
  const [role, setRole] = useState<Role>("protester");
  const [name, setName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [serverStatus, setServerStatus] = useState(
    "Connecting to public world…",
  );
  useEffect(() => {
    let cancelled = false;
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Server unavailable");
        const data = (await response.json()) as { profile: Profile };
        if (!cancelled) {
          setProfile(data.profile);
          setName(data.profile.name);
          setServerStatus("Persistent public world");
        }
      })
      .catch(() => {
        if (!cancelled)
          setServerStatus("Server unavailable · start npm run dev");
      });
    return () => {
      cancelled = true;
    };
  }, [playing]);
  if (playing)
    return (
      <GameScreen
        mapId={mapId}
        role={role}
        name={name.trim()}
        onExit={() => setPlaying(false)}
      />
    );
  const location = locations.find((item) => item.id === mapId)!;
  const selectedRole = roles.find((item) => item.id === role)!;

  return (
    <main className="crossline-menu">
      <header className="crossline-header">
        <Link href="/" className="crossline-logo" aria-label="Faultline home">
          <span aria-hidden="true">╱╱</span> FAULTLINE
        </Link>
        <nav aria-label="Main navigation">
          <a href="#locations">The locations</a>
          <a href="#roles">Choose your side</a>
          <a href="#field-guide">Field guide</a>
        </nav>
        <span className="practice-status">
          <i /> {serverStatus}
        </span>
      </header>
      <section className="crossline-hero" aria-labelledby="game-title">
        <Image
          className="hero-art"
          src="/img/crossline-hero.png"
          alt="Pixel-art crowds gather along a lamp-lit city boulevard, facing a distant police line."
          fill
          priority
          sizes="100vw"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="hero-heading">
            <span className="street-sticker">Every street has two sides</span>
            <h1 id="game-title">
              FAULTLINE<span>CROWD COMMAND</span>
            </h1>
            <p>
              A city on the edge. A crowd with a mind of its own.
              <br />
              Pick your side. Step into the street.
            </p>
            <div className="hero-facts">
              <span>
                <b>Live</b> autonomous crowds
              </span>
              <span>
                <b>4</b> perspectives
              </span>
              <span>
                <b>One</b> continuous public world
              </span>
            </div>
          </div>
          <form
            className="registration"
            onSubmit={(event) => {
              event.preventDefault();
              document.getElementById("locations")?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
                block: "start",
              });
            }}
          >
            <span className="step-label">01 / Report in</span>
            <h2>
              Your city.
              <br />
              Your callsign.
            </h2>
            <p>The crowd is gathering. Make yourself known.</p>
            <label htmlFor="callsign">Callsign</label>
            <input
              id="callsign"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={24}
              placeholder="Enter your callsign…"
              autoComplete="off"
            />
            <button className="launch-button" type="submit">
              Join the streets <span aria-hidden="true">↗</span>
            </button>
            <p className="registration-note">
              Guest identity saved in this browser. Military appointments are
              earned.
            </p>
          </form>
        </div>
        <div className="hero-caption">
          <span>One crowd. Countless intentions.</span>
          <span>Delhi inspired / Paris inspired</span>
        </div>
      </section>
      <div className="menu-body">
        <section
          id="locations"
          className="location-section"
          aria-labelledby="location-title"
        >
          <div className="menu-section-heading">
            <div>
              <span className="step-label">02 / Choose your theatre</span>
              <h2 id="location-title">Every city has a breaking point.</h2>
            </div>
            <p>Two cities. Different streets. The same tension.</p>
          </div>
          <div className="illustrated-locations">
            {locations.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`illustrated-location ${mapId === item.id ? "is-selected" : ""}`}
                style={{ "--card-accent": item.color } as React.CSSProperties}
                aria-pressed={mapId === item.id}
                onClick={() => setMapId(item.id)}
              >
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="(max-width: 480px) 100vw, 50vw"
                />
                <span className="location-shade" />
                <span className="location-atmosphere">{item.atmosphere}</span>
                <span className="selection-badge">
                  {mapId === item.id ? "✓ Selected" : "Select location"}
                </span>
                <span className="location-copy">
                  <span>{item.landmark}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section
          id="roles"
          className="role-section"
          aria-labelledby="role-title"
        >
          <div className="menu-section-heading">
            <div>
              <span className="step-label">03 / Choose your side</span>
              <h2 id="role-title">Where do you stand?</h2>
            </div>
            <p>Same city. Four very different stories.</p>
          </div>
          <div className="illustrated-roles">
            {roles.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`illustrated-role ${role === item.id ? "is-selected" : ""}`}
                style={{ "--card-accent": item.color } as React.CSSProperties}
                aria-pressed={role === item.id}
                disabled={item.id === "military" && !profile?.appointmentUntil}
                onClick={() => setRole(item.id)}
              >
                <span className="role-portrait">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(max-width: 750px) 50vw, 25vw"
                  />
                  <span className="portrait-shade" />
                  <span className="role-selection">
                    {item.id === "military" && !profile?.appointmentUntil
                      ? "Earn a police appointment"
                      : role === item.id
                        ? "✓ Selected"
                        : "+ Choose role"}
                  </span>
                </span>
                <span className="role-copy">
                  <span className="role-tag">{item.tag}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span className="role-controls">{item.control}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section
          className="deployment-bar"
          aria-label="Deploy to your chosen location"
        >
          <div>
            <span className="step-label">Your operation</span>
            <h2>
              {location.name}
              <span> / {selectedRole.name}</span>
            </h2>
            <p>
              {name.trim().length >= 2
                ? `Ready when you are, ${name.trim()}.`
                : "Enter your callsign above to begin."}
            </p>
          </div>
          <button
            className="launch-button"
            disabled={name.trim().length < 2 || !profile}
            onClick={() => setPlaying(true)}
          >
            Enter the city <span aria-hidden="true">↗</span>
          </button>
          <p className="practice-explanation">
            Saved profile · {profile?.credits ?? "—"} fictional credits. The
            world continues when you leave.
          </p>
        </section>
        <section
          id="field-guide"
          className="field-guide"
          aria-labelledby="field-guide-title"
        >
          <div>
            <span className="step-label">Field intel</span>
            <h2 id="field-guide-title">The crowd doesn’t wait for you.</h2>
            <p>
              Personalities collide. Lines shift. A quiet square can change in
              seconds.
            </p>
          </div>
          <div className="intel-list">
            <article>
              <span aria-hidden="true">◉</span>
              <div>
                <h3>A mind behind every movement</h3>
                <p>
                  Agents march, chant, flee and respond to danger according to
                  their own courage, aggression and discipline.
                </p>
              </div>
            </article>
            <article>
              <span aria-hidden="true">⌘</span>
              <div>
                <h3>Command carries consequences</h3>
                <p>
                  Move your officers into formation. Detain nearby threats.
                  Military engagement requires a warning and an imminent serious
                  threat.
                </p>
              </div>
            </article>
            <article>
              <span aria-hidden="true">↗</span>
              <div>
                <h3>Watch more than the street</h3>
                <p>
                  Persistent markets react to tension and damage. Fund a side
                  and a supply truck physically delivers crates into the city.
                </p>
              </div>
            </article>
          </div>
        </section>
        <footer className="crossline-footer">
          <Link href="/" className="crossline-logo">
            <span aria-hidden="true">╱╱</span> FAULTLINE
          </Link>
          <p>A city in the balance.</p>
          <a href="https://github.com/aryan-astra/Crossline-multiplayer">
            Project on GitHub ↗
          </a>
        </footer>
      </div>
    </main>
  );
}
