# The Violin: story draft v0.1

Draft of what goes where on your site. Nothing here is final. Lines marked **(ask)** need your call before they go live.

## The idea in one paragraph

The visitor is the bow. Scrolling draws the bow across the instrument, and the camera travels down the violin from the scroll at the top to the end button at the bottom. Each part of the violin holds one chapter of your life, and the order runs roughly in time: roots at the top, what's next at the bottom. Halfway down, the camera dives through an f-hole into the dark inside of the body, where the sound post sits. In French that piece is called *l'âme* and in Italian *anima*, the soul. The site runs on anime.js, so the name fits.

## Who it's for

Your internship strategy changed on Nov 9: you're reaching out directly to physical AI and quant startups. This site is the link at the bottom of those emails. A founder who clicks it should know in ten seconds that you do robot learning research and build trading systems, and should be able to skip the show and read the facts. So the site has two modes:

- **The performance:** the full scroll journey with sound.
- **Program notes:** a one-page quick read (like a concert program) with every role, link and the resume PDF. One button, always visible.

## The journey, top to bottom

| # | Violin part | What the part does | Your chapter |
|---|---|---|---|
| 0 | Tuning | The orchestra tunes to A before anything starts | Loading screen and sound on/off |
| 1 | Scroll | Hand-carved; every maker's scroll is a signature | Who I am |
| 2 | Pegbox and pegs | Pegs set each string's pitch | Roots: home, family, music training |
| 3 | Nut | The ridge where the strings begin | First work, before college |
| 4 | Fingerboard | No frets: you find every note by ear | UMD and learning |
| 5 | The four strings | G, D, A, E | What I'm doing now |
| 6 | Bridge | Carries the strings' vibration into the body | Teaching and mentoring |
| 7 | f-holes | Where the sound leaves the instrument | What I've shipped |
| 8 | Sound post (inside) | *L'âme*, the soul; holds the whole body up | The people |
| 9 | Bass bar (inside) | Supports the low end so it doesn't buckle | What keeps me steady |
| 10 | Tailpiece and fine tuners | Anchors the strings; makes the last small adjustments | What's next |
| 11 | Chinrest, end button, bow | Where the player meets the instrument | Play it yourself, and contact |

---

### 0. Tuning (entry screen)

**On screen:** Black stage. One warm spotlight. Rosin dust drifts in the beam. Your name, small. Two buttons: **Begin with sound** and **Enter in silence**.

**What happens:** Press Begin and a single A rings out, the note an orchestra tunes to. The four strings tune one at a time (A, then D, G, E), each one lighting up as it locks to pitch. That's the loading bar. When the last string settles, the camera starts moving.

**Sound:** A440, then open-string fifths. A tanpura drone fades in underneath and stays for the whole visit.

---

### 1. The scroll: who I am

**Copy (draft):**
> I'm Pranav Puranik. I study computer science at the University of Maryland, I do robot learning research, and I build trading systems that have to be right to the cent. I also play violin, Hindustani and Western classical.
>
> Scroll to play.

**See:** Extreme close-up of the scroll's spiral. The spiral line draws itself in, then the camera pulls back to reveal the pegbox.

**Hear:** The alap begins: slow, unmetered phrases over the drone. Scroll speed controls how loud and bright it gets, the way bow speed does.

---

### 2. The pegbox and pegs: what tuned me

**Copy (draft):**
> I grew up in Monroe Township, New Jersey, in a Marathi family **(ask: right?)**. Four pegs tune a violin. These are mine.

Each peg holds one influence. Turning a peg (hover or drag) bends the pitch and reveals a line:
- **My parents** **(ask: how much to say, and whether to use Aai and Baba)**
- **Music:** Hindustani classical violin, and mentorship from sitarist Partha Bose **(ask: OK to name him? who else taught you, and since what age?)**
- **Monroe Township High School,** class of 2025
- **(ask: a fourth peg.)** Options: a place, a teacher, a moment that set you on CS.

**See:** Pegs turn; strings tighten; a faint pitch meter needle swings to center.
**Hear:** Wooden peg creak plus a pitch glide that lands in tune.

---

### 3. The nut: where the strings start

**Copy (draft):**
> I started working before I started college.

- **Kulicke & Soffa, July 2024.** Ball-bonding department intern. I ran experiments on semiconductor ball-bonding machines, wrote wiring programs in their CAD software, and measured bonds under a microscope.
- **HealthSutra Analytics, Feb – Aug 2025.** Startup engineer, remote, reporting to the founders. I built the platform three medical advisors used to validate AI-generated health insights, a patient management portal for the first partner hospitals, and internal tooling to test and compare Gemini model outputs.

**See:** The strings begin here as thin lines of light leaving the nut.
**Hear:** The first plucked notes, one per entry.

---

### 4. The fingerboard: no frets

**Copy (draft):**
> A violin has no frets. You learn where each note lives by ear, by repetition, and by getting it wrong.

- B.S. Computer Science, Machine Learning track, University of Maryland. Started Fall 2025, graduating May 2029.
- Presidential Scholarship.
- Courses as finger tapes (the strips beginners stick on the fingerboard to find notes): Linear Algebra, Algorithms, Programming Languages, Probability and Statistics, World Pop Music & Identity **(ask: which courses to show)**.
- GPA stays off. **(ask if you want it on.)**

**See:** Camera glides down the fingerboard. Tape strips appear one by one; each one labels a course.
**Hear:** Scroll position along the fingerboard sets the pitch. Scrolling down plays a slow ascending scale in your raga. The page itself becomes the fingerboard.

---

### 5. The four strings: what I'm doing now

The camera swings round to look straight down the strings. Each string is one lane. Hover a string and it plucks at its real pitch. Each lane opens in turn as you scroll.

#### G string: research (lowest, darkest, most resonant)

> I'm an undergraduate research assistant in the 3D Computer Vision Lab at UMD, working with PhD student Daniel Ekpo since January 2026. We study how far a robot can get on the small amount of demonstration data an academic lab can collect.

- Collected 50–100 teleoperated demonstrations per task with a Meta Quest headset, across five manipulation tasks, one of them long-horizon.
- Built on P3-PO: a person marks a few key points, vision models track them, and the policy learns from the points instead of raw pixels.
- Got the lab's enhanced P3-PO to its first consistently successful task completion, and ran the evaluation pipeline (30 trials per method, baseline vs. ours). Found the bug: the config's camera calibration and robot start pose didn't match the real setup.
- Co-author on a robot learning paper submitted to CVPR 2027. **(ask: CVPR is double-blind. Check with Daniel before naming Relate2Act on a public page during review. Until then: "a paper under review at a top vision conference.")**
- Next: co-leading a 3D scene reconstruction project with one other undergrad.

**See:** Glowing tracked points ride on a robot arm silhouette (the P3-PO idea, drawn as dots and motion paths).

#### D string: quant

> I'm a quantitative analyst on the Apex Quant team at Apex Fund, a student-run investment fund. I also build my own trading infrastructure.

- **Apex Fund, Oct 2026 – now.** Made it through a four-stage selection. Replicated Bilello and Gayed's 2014 beta rotation paper on 87 years of data, matching its results within 0.2% **(ask: which metrics)**. Now extending it to lead-lag effects across 48 industries with a four-person team. We present on Dec 15.
- **CarryBot, Oct 31 – Nov 9, 2026.** A delta-neutral bitcoin funding-rate carry bot on Kalshi and Alpaca. I set the strategy, the venues and the risk limits, and built it with an AI coding agent. Its ledger reconciles to the venues to the cent. I took it live with $50 to prove the execution path, measured the edge at about 2% a year over T-bills, and stopped there.
- **Strategy Iteration Harness, Jul – Aug 2026.** A multi-strategy algorithmic trading platform (Python, FastAPI, SQLite, React) on Alpaca paper accounts.
- No backtest returns anywhere on the site.

**See:** A ledger scrolls past, two columns that always balance; the difference counter sits at $0.00.

#### A string: building (the note the orchestra tunes to)

> I founded Liquid, a prepaid ordering app for local restaurants in College Park. Load a wallet once, then order ahead and pay from your balance. *Your local spots, a little cheaper.*

- Live iPhone app, merchant portal, admin console and website, with Stripe Connect payouts. Designed and directed by me, built with AI coding tools.
- **(ask: you left Liquid off LinkedIn today. Keep it on the site or not?)**
- **(ask: 7 live partner restaurants, or 12 signed? Your notes have both.)**
- **(ask: anything else for this string?)** Candidates: Jarvis (your AI assistant with a memory graph), CornerMan AI (your role is still unconfirmed), FlickUp.

#### E string: music (highest, brightest, carries the melody)

> I play Hindustani classical and Western classical violin. I've posted my recitals on YouTube since April 2020.

- Embedded recital clips. **(ask: your 2–3 best performances)**
- One line on what it's like to switch between the two traditions. **(ask: in your words)**

**See:** The E string glows gold. Sound rings rise off it.

**Hear across section 5:** The jor starts. A steady pulse enters under the melody, and each string adds its own voice. Pizzicato on hover.

---

### 6. The bridge: passing it on

**Copy (draft):**
> The bridge carries the strings' vibration into the body. Without it, a violin barely makes a sound.
>
> In summer 2026 I was a program assistant in San Jose for a residential hardware and design program: 25 high school students, taught by engineers and designers from one of the world's largest consumer technology companies.

- I was the cohort's go-to for CAD, 3D printing, microcontrollers and firmware.
- One team's build stalled right before the final showcase. I spent days with them isolating power, wiring, pin and code faults, and coached them through it so they could explain their own system. They demoed it working to a senior hardware executive.
- I also ran residential life: housing, evening programs, and trips around the Bay Area.

(Following your rule: no host company or executive names.)

**See:** A wave travels from the strings, through the bridge, into the body.
**Hear:** The tabla enters. The gat begins.

---

### 7. The f-holes: what got out into the world

**Copy (draft):**
> Sound leaves a violin through the f-holes. This is what I've put out.

A gallery of cards that ride out on rings of sound: the CVPR submission (once allowed), Liquid, CarryBot, Strategy Iteration Harness, recitals. Each card links to code, demo or video. **(ask: which repos are public, and which links you want shown.)**

**Then the big moment:** the camera dives through the f-hole into the body.
**Hear:** A rush of air, then everything muffles and warms, like you're inside the wood. The music keeps playing, low-passed and close.

---

### 8. Inside: the sound post (*l'âme*)

**Copy (draft):**
> Inside every violin stands a small spruce dowel, unglued, held in place by pressure alone. Move it a millimeter and the whole voice changes. The French call it *l'âme*. The Italians call it *anima*. The soul.
>
> Mine is the people.

- Family **(ask)**
- Mentors: Daniel Ekpo in research, Partha Bose in music **(ask)**
- Friends: roommates, the volleyball group **(ask: names or just groups?)**

Small easter egg: "This site runs on anime.js. *Anima*, fittingly."

**See:** Darkness, warm amber light through the f-hole slots, wood grain, dust.
**Hear:** Drone, a slow heartbeat on the bayan, nothing else.

---

### 9. Inside: the bass bar (what keeps me steady)

**Copy (draft):**
> Along the inside of the top runs the bass bar, a strip of spruce that keeps the low notes from buckling the wood.

- Volleyball: pickup, grass, and an intramural 4s team.
- **(ask: other things that keep you steady.)** Running? Food? Cooking? Anything you'd tell a founder over coffee.

---

### 10. The tailpiece and fine tuners: what's next

The camera exits through the other f-hole and moves to the tailpiece.

**Copy (draft):**
> The tailpiece anchors every string. The fine tuners make the last small adjustments.

- Looking for a Summer 2027 internship at a physical AI or quant startup.
- Presenting the lead-lag research Dec 15.
- Starting the 3D scene reconstruction project.
- Someday: China. **(ask: keep?)**

**Hear:** The jhala. Fast, bright, everything at full energy.

---

### 11. Chinrest, end button and bow: play it yourself

The camera pulls back to the full violin. A bow appears.

**Copy (draft):**
> Your turn.

- Drag across the strings to bow. Keys 1–4 change strings; number keys or taps finger notes. **(ask: want this, or too much?)**
- The music ends with a tihai: one phrase three times, landing on *sam*, the first beat, exactly as the contact links appear.
- Contact: email **(ask: which public email)**, LinkedIn, GitHub, YouTube, resume PDF.
- Small print: credits for the 3D model and samples.

---

## Sound design

The score follows a Hindustani performance from start to finish, so the music builds as you go deeper:

| Section | Raga stage | Feel |
|---|---|---|
| Tuning, scroll, pegs, nut | Alap | Slow, free, no pulse |
| Fingerboard, strings | Jor | Pulse enters |
| Bridge, f-holes | Gat | Tabla joins |
| Inside (sound post, bass bar) | (break) | Muffled, heartbeat, drone only |
| Tailpiece | Jhala | Fast, bright |
| Finale | Tihai | Three phrases landing on sam |

- **Raga:** Yaman as the default (an evening raga). **(ask: your pick)**
- **Scroll speed is bow speed:** fast scrolling swells the sound; stopping lets it decay to the drone, like a held note dying away.
- **SFX:** peg creak, pizzicato per string, bow scrape on fast scrolls, wood knock entering the body, air rush through the f-hole, the final sam hit.
- **Mute button** on every screen. The site works fully in silence.

**The best version uses your playing.** **(ask: can you record these on your phone?)**
1. 60–90 s of alap in your raga
2. 60 s of a medium-tempo gat
3. 30–60 s of a Western piece you like
4. Each open string, bowed and plucked
5. A short ascending scale
6. A peg turn and a bow scrape (yes, really)

If not, I'll build the score from a synthesized tanpura plus free violin samples, and swap in your recordings later.

## Visual design

- Dark concert stage, one warm spotlight, varnished maple and spruce, gold string highlights.
- **Signature effect:** rosin dust floating in the light, which scatters when you scroll fast.
- Strings that actually vibrate when plucked. Sound waves leaving the f-holes as rings.
- Type: an elegant display face for chapter titles, a clean sans for facts.
- Side nav: a small violin outline. Your current part glows; click any part to jump.

## Tech plan (short)

- **anime.js v4** runs the show: scroll-synced timelines, SVG line drawing, text reveals, staggers and springs. It also drives the 3D camera.
- **Three.js** for the violin model and the camera path, with bloom, grain and depth of field.
- **Web Audio** for the layered score, filters (the muffled inside), and SFX.
- Vite, plain JavaScript, deployed on Vercel.
- Reduced-motion and low-power modes fall back to the program notes and an SVG violin.

**Violin model (ask):**
1. Scan your own violin with an iPhone app like Polycam (most personal; shiny varnish makes it tricky, and strings get rebuilt in code).
2. A free Creative Commons model, credited in the footer. (Fastest.)
3. A stylized 3D violin built in code. (Most control over the look.)

My pick: start with 2 so we can build now, and swap in your scan if it comes out clean.

## Kept off the site

Home address, birthday, GPA (unless you say otherwise), host company and executive names from the San Jose program, family details beyond what you approve, internship rejections, any backtest or paper-trading returns, and the CVPR paper title until review rules allow it.

## Open questions, all in one place

1. Liquid: on the site or off? And 7 live or 12 signed?
2. CVPR paper: name it now, or wait until decisions?
3. Music: how long you've played, your teachers, best recitals, and your raga pick.
4. Will you record the audio stems?
5. Family and friends: how much to say, and names or not?
6. The fourth peg, and what keeps you steady.
7. Extra projects: Jarvis, CornerMan AI, FlickUp, the QuantConnect pipeline?
8. Violin model: scan yours or use a free one to start?
9. "Play it yourself" finale: yes or too much?
10. Public email, and do you have a domain in mind?
