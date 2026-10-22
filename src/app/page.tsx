"use client";

import { useState } from "react";
import Link from "next/link";
import GameScreen from "@/components/GameScreen";
import type { MapId, Role } from "@/game/types";

const locations: {
  id: MapId;
  name: string;
  source: string;
  number: string;
  description: string;
}[] = [
  {
    id: "delhi",
    name: "Meridian Quarter",
    source: "Inspired by Delhi",
    number: "01",
    description:
      "Sandstone instruments, narrow gates, and a gathering in the observatory gardens.",
  },
  {
    id: "paris",
    name: "Concord Square",
    source: "Inspired by Paris",
    number: "02",
    description:
      "Wide boulevards meet an open civic square. Every approach changes the balance.",
  },
];
const roles: { id: Role; title: string; mark: string; description: string }[] =
  [
    {
      id: "protester",
      title: "Protester",
      mark: "↗",
      description:
        "Join the crowd. Rally morale with your voice. Find your way through the city.",
    },
    {
      id: "police",
      title: "Police",
      mark: "◇",
      description:
        "Hold the perimeter. Direct your officers and detain active violent actors.",
    },
    {
      id: "military",
      title: "Military",
      mark: "+",
      description:
        "Observe strict engagement rules. Warn first; engage only an active threat.",
    },
    {
      id: "watcher",
      title: "Spectator",
      mark: "◎",
      description:
        "Read the whole scene. Explore the practice market and fund supply deliveries.",
    },
  ];

export default function Home() {
  const [mapId, setMapId] = useState<MapId>("delhi");
  const [role, setRole] = useState<Role>("protester");
  const [name, setName] = useState("Rookie");
  const [playing, setPlaying] = useState(false);
  if (playing)
    return (
      <GameScreen
        mapId={mapId}
        role={role}
        name={name.trim() || "Rookie"}
        onExit={() => setPlaying(false)}
      />
    );
  return (
    <main className="menu">
      <header className="masthead">
        <Link href="/" className="wordmark">
          CROSSLINE
        </Link>
        <span className="status">
          <i /> LOCAL PRACTICE / V.01
        </span>
        <a href="https://github.com/aryan-astra/Crossline-multiplayer">
          PROJECT ↗
        </a>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">URBAN CROWD SIMULATION · FIELD OPERATIONS</p>
          <h1>
            Every crowd
            <br />
            has a <em>tipping point.</em>
          </h1>
          <p className="intro">
            One city. Conflicting intentions. Step into a living crowd and
            discover what it takes to change its course.
          </p>
          <div className="hero-note">
            <span>↳</span>
            <p>
              Autonomous agents. Consequential choices.
              <br />
              Five minutes on the ground.
            </p>
          </div>
        </div>
        <div className="city-art" aria-hidden="true">
          <div className="grid-lines" />
          <div className="plaza" />
          <div className="street street-a" />
          <div className="street street-b" />
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className={`building building-${i}`} />
          ))}
          <div className="crowd-dots">
            {Array.from({ length: 32 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${20 + ((i * 31) % 65)}%`,
                  top: `${23 + ((i * 17) % 60)}%`,
                  background: i % 4 === 0 ? "#83aaba" : "#e7a367",
                }}
              />
            ))}
          </div>
          <span className="art-label">
            SECTOR 01 <b>●</b> CROWD ACTIVITY
          </span>
          <div className="coordinate">28°37′ N / SIMULATION VIEW</div>
        </div>
      </section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPlaying(true);
        }}
        className="deployment"
      >
        <div className="section-title">
          <p className="eyebrow">PREPARE YOUR OPERATION</p>
          <span>01 / LOCATION & ROLE</span>
        </div>
        <div className="location-grid">
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              aria-pressed={mapId === location.id}
              className={`location-card ${mapId === location.id ? "selected" : ""}`}
              onClick={() => setMapId(location.id)}
            >
              <span className="card-number">
                {location.number} / {location.source}
              </span>
              <h2>{location.name}</h2>
              <p>{location.description}</p>
              <span className="selection-mark">
                {mapId === location.id ? "SELECTED ●" : "SELECT LOCATION ↗"}
              </span>
            </button>
          ))}
        </div>
        <fieldset>
          <legend>CHOOSE YOUR PERSPECTIVE</legend>
          <div className="role-grid">
            {roles.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={role === item.id}
                className={`role-card ${role === item.id ? "selected" : ""}`}
                onClick={() => setRole(item.id)}
              >
                <span className="role-mark">{item.mark}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="deploy-footer">
          <label>
            YOUR CALLSIGN
            <input
              required
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p>
            Practice session · All roles available
            <br />
            No account, persistent rewards, or shared multiplayer.
          </p>
          <button type="submit" className="primary">
            Enter the city <span>↗</span>
          </button>
        </div>
      </form>
      <footer className="site-footer">
        <span>CROSSLINE / A CITY IN THE BALANCE</span>
        <span>WASD TO MOVE · E TO INTERACT · SCROLL TO ZOOM</span>
      </footer>
    </main>
  );
}
