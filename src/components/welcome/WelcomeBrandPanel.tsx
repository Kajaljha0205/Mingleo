const TRAILS = [
  { delay: "0s", d: "M110,90 C170,110 240,170 292,180" },
  { delay: "-0.4s", d: "M200,350 C230,300 270,240 298,196" },
  { delay: "-0.8s", d: "M340,150 C330,165 318,175 308,182" },
  { delay: "-10s", d: "M340,150 C370,154 395,157 421,158" },
  { delay: "-10.4s", d: "M330,300 C380,270 420,220 432,170" },
  { delay: "-10.7s", d: "M545,140 C500,146 465,152 440,157" },
  { delay: "-5s", d: "M330,300 C360,320 390,342 412,353" },
  { delay: "-5.3s", d: "M200,350 C280,372 350,368 410,364" },
  { delay: "-5.6s", d: "M540,420 C500,398 460,378 429,366" },
  { delay: "-5.9s", d: "M430,240 C428,290 424,325 421,350" },
] as const;

const IDLE_PEOPLE = [
  { left: 70, top: 200, delay: "-1s" },
  { left: 150, top: 280, delay: "-2.5s" },
  { left: 300, top: 60, delay: "-0.6s" },
  { left: 490, top: 260, delay: "-3.2s" },
  { left: 380, top: 220, delay: "-1.8s" },
  { left: 260, top: 410, delay: "-2.9s" },
  { left: 520, top: 60, delay: "-0.2s" },
] as const;

const FIGURINES = [
  // Meetup A: Street shopping · Brigade Road
  { path: "M110,90 C170,110 240,170 292,180", delay: "0s", head: "#D9A36B", body: "#4A88B8" },
  { path: "M200,350 C230,300 270,240 298,196", delay: "-0.4s", head: "#8A5530", body: "#E9D9A6" },
  { path: "M340,150 C330,165 318,175 308,182", delay: "-0.8s", head: "#C08A55", body: "#C98466" },
  // Meetup B: Cafe hopping · Indiranagar
  { path: "M340,150 C370,154 395,157 421,158", delay: "-10s", head: "#9A6440", body: "#F2F0EA" },
  { path: "M330,300 C380,270 420,220 432,170", delay: "-10.4s", head: "#6B4126", body: "#6E9C7A" },
  { path: "M545,140 C500,146 465,152 440,157", delay: "-10.7s", head: "#D9A36B", body: "#C98466" },
  // Meetup C: Board games · HSR Layout
  { path: "M330,300 C360,320 390,342 412,353", delay: "-5s", head: "#8A5530", body: "#4A88B8" },
  { path: "M200,350 C280,372 350,368 410,364", delay: "-5.3s", head: "#C08A55", body: "#E9D9A6" },
  { path: "M540,420 C500,398 460,378 429,366", delay: "-5.6s", head: "#9A6440", body: "#6E9C7A" },
  { path: "M430,240 C428,290 424,325 421,350", delay: "-5.9s", head: "#6B4126", body: "#F2F0EA" },
] as const;

export function WelcomeBrandPanel() {
  return (
    <section data-testid="brand-panel" className="welcome-brand-panel">
      <div className="welcome-wordmark">
        mingleo<span className="welcome-wordmark-dot">.</span>
      </div>

      <div className="welcome-copy">
        <h1 className="welcome-headline" aria-label="Real people. Real plans.">
          <span aria-hidden="true">
            <span className="welcome-swap-slot">
              <span className="welcome-reel">
                Reel<span className="welcome-cut">Reel</span>
              </span>
              <span className="welcome-real">Real</span>
            </span>{" "}
            people.
            <br />
            <span className="welcome-line2">Real plans.</span>
          </span>
        </h1>
        <p className="welcome-subline">
          Less scrolling, more strolling. Meet people nearby who&rsquo;re into what you&rsquo;re into.
        </p>
      </div>

      <div className="welcome-map-wrap">
        <div className="welcome-stage">
          <svg
            width="560"
            height="440"
            viewBox="0 0 560 440"
            fill="none"
            role="img"
            aria-label="Stylised map of Bengaluru with people walking to meet up at Brigade Road, Indiranagar and HSR Layout"
            className="welcome-map-svg"
          >
            {/* faint grid streets */}
            <g stroke="#2F3A42" strokeWidth="1">
              <path d="M0,40 H560 M0,110 H560 M0,180 H560 M0,250 H560 M0,320 H560 M0,390 H560" />
              <path d="M60,0 V440 M150,0 V440 M240,0 V440 M330,0 V440 M420,0 V440 M510,0 V440" />
            </g>
            {/* parks & Ulsoor Lake */}
            <path d="M196,170 C200,150 246,146 262,162 C276,178 262,214 236,216 C210,218 192,192 196,170 Z" fill="#35503F" />
            <path d="M228,272 C236,258 268,258 276,274 C282,290 262,304 244,300 C228,296 222,284 228,272 Z" fill="#35503F" />
            <path d="M326,132 C334,122 356,124 360,136 C364,150 350,160 338,158 C326,156 320,142 326,132 Z" fill="#2E4A5E" />
            {/* arterial roads */}
            <g stroke="#3E4B54" strokeWidth="3.5" strokeLinecap="round">
              <path d="M10,58 C120,100 180,150 230,190 S330,180 430,160 S520,150 552,140" />
              <path d="M230,190 C220,260 210,310 200,350 S190,410 186,436" />
              <path d="M300,186 C315,230 325,270 330,300 S390,340 420,360 S500,400 552,426" />
              <path d="M200,350 C260,322 300,305 330,300 S400,282 428,240 S442,192 430,160" />
              <path d="M110,90 C150,60 260,50 340,150" />
            </g>
            {/* walking trails */}
            <g stroke="#7FA8C6" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round">
              {TRAILS.map((t, i) => (
                <path key={i} className="welcome-trail" style={{ animationDelay: t.delay }} d={t.d} />
              ))}
            </g>
            {/* neighbourhood nodes */}
            <g fill="#56646D">
              <circle cx="110" cy="90" r="4" />
              <circle cx="340" cy="150" r="0" />
              <circle cx="300" cy="186" r="4" />
              <circle cx="330" cy="300" r="4" />
              <circle cx="200" cy="350" r="4" />
              <circle cx="545" cy="140" r="4" />
            </g>
            <g fontFamily="var(--font-sans)" fontSize="11.5" fontWeight="500" fill="#A3AFB6" letterSpacing=".3">
              <text x="70" y="76">Malleshwaram</text>
              <text x="194" y="236">Cubbon Park</text>
              <text x="306" y="206">MG Road</text>
              <text x="336" y="118">Ulsoor Lake</text>
              <text x="440" y="186">Indiranagar</text>
              <text x="250" y="322">Lalbagh</text>
              <text x="342" y="296">Koramangala</text>
              <text x="150" y="374">Jayanagar</text>
              <text x="440" y="392">HSR Layout</text>
              <text x="488" y="128">Whitefield →</text>
            </g>
          </svg>

          {/* idle people around the city */}
          {IDLE_PEOPLE.map((p, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="welcome-idle"
              style={{ left: `${p.left}px`, top: `${p.top}px`, animationDelay: p.delay }}
            />
          ))}

          {/* walking figurines */}
          {FIGURINES.map((f, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="welcome-fig"
              style={{ offsetPath: `path('${f.path}')`, animationDelay: f.delay }}
            >
              <span className="welcome-hd" style={{ background: f.head }} />
              <span className="welcome-bd" style={{ background: f.body }} />
            </span>
          ))}

          {/* Meetup A: Street shopping · Brigade Road */}
          <div className="welcome-anchor" style={{ left: "300px", top: "186px" }} aria-hidden="true">
            <span className="welcome-ripple" style={{ animationDelay: "0s" }} />
            <div className="welcome-pinin" style={{ animationDelay: "0s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#283239" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8h14l-1 12H6z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
            </div>
            <div className="welcome-card" style={{ top: "14px", background: "rgba(50,62,70,.92)", animationDelay: "0s" }}>
              <div className="welcome-card-title">Street shopping · Brigade Road</div>
              <div className="welcome-card-meta">3 going · Sat 4:00 pm</div>
            </div>
          </div>

          {/* Meetup B: Cafe hopping · Indiranagar */}
          <div className="welcome-anchor" style={{ left: "430px", top: "160px" }} aria-hidden="true">
            <span className="welcome-ripple" style={{ animationDelay: "-10s" }} />
            <div className="welcome-pinin" style={{ animationDelay: "-10s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#283239" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z" />
                <path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" />
                <path d="M8 3.5c0 1.2 1.5 1.3 1.5 2.5M12 3.5c0 1.2 1.5 1.3 1.5 2.5" />
              </svg>
            </div>
            <div className="welcome-card" style={{ top: "-66px", background: "rgba(255,255,255,.08)", animationDelay: "-10s" }}>
              <div className="welcome-card-title">Cafe hopping · Indiranagar</div>
              <div className="welcome-card-meta">3 going · Sun 11:00 am</div>
            </div>
          </div>

          {/* Meetup C: Board games · HSR Layout */}
          <div className="welcome-anchor" style={{ left: "420px", top: "360px" }} aria-hidden="true">
            <span className="welcome-ripple" style={{ animationDelay: "-5s" }} />
            <div className="welcome-pinin" style={{ animationDelay: "-5s" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#283239" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="3.5" />
                <circle cx="9" cy="9" r="1" fill="#283239" />
                <circle cx="15" cy="15" r="1" fill="#283239" />
                <circle cx="15" cy="9" r="1" fill="#283239" />
                <circle cx="9" cy="15" r="1" fill="#283239" />
              </svg>
            </div>
            <div className="welcome-card" style={{ top: "-66px", background: "rgba(255,255,255,.08)", animationDelay: "-5s" }}>
              <div className="welcome-card-title">Board games · HSR Layout</div>
              <div className="welcome-card-meta">4 going · Fri 8:00 pm</div>
            </div>
          </div>
        </div>
      </div>

      <div className="welcome-desktop-footer">
        <div className="welcome-pilot-badge">
          <span aria-hidden="true" className="welcome-live" />
          Piloting in Bengaluru
        </div>
      </div>
    </section>
  );
}
