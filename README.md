# pranav puranik · personal site

A scroll-driven walk down a violin. Each part of the instrument holds one chapter, from the scroll at the top to the end button, and the music follows a Hindustani performance as you go deeper: alap, jor, gat, a quiet passage inside the body, jhala, and a closing tihai.

- **3D:** a violin built from measurements in Three.js (no model files): arched plates, f-holes you can fly through, sound post, bass bar, and a maker's label inside.
- **Motion:** anime.js v4 drives the scroll-synced camera, text reveals, the tuning gate and the small data visuals.
- **Sound:** a live Web Audio score: Karplus-Strong tanpura, synthesized tabla, violin samples with meend, and strings you can pluck with the cursor (or A S D F).

## Run

```bash
npm install
npm run dev
```

```bash
npm run build
```

`npm run build` writes a static site to `dist/` that any static host (Vercel, Netlify, GitHub Pages) can serve.

## Where things live

| File | What it does |
|---|---|
| `index.html` | All copy: chapters, tuning gate, program notes |
| `src/main.js` | Scroll, camera, chapter changes, string plucking, render loop |
| `src/stations.js` | The camera route and which raga stage plays in each chapter |
| `src/violin.js` | The instrument, part by part |
| `src/woodtex.js` | Spruce, flamed maple, ebony and the label, painted on canvases |
| `src/geometry2d.js` | Body outline, arching and f-hole shapes |
| `src/stage.js` | Renderer, lights, rosin dust, film grain |
| `src/audio.js` | The score and sound effects |
| `src/ui.js` | Gate, panels, chapter index, program notes |
| `src/style.css` | Type and layout |

To change a chapter's text, edit its `<article class="panel" data-key="...">` in `index.html`. To move the camera for a chapter, edit its entry in `src/stations.js`.

## Credits

Violin samples from the Musyng Kite soundfont (CC BY-SA 3.0), via gleitz/midi-js-soundfonts. Everything else is generated in code.
