Project website for KITE: Decoupling Kinematics and Interaction for Zero-Shot Cross-Embodiment Manipulation.

The official site is a static HTML/CSS page. To preview locally, run
`python3 -m http.server 8765` and open `http://localhost:8765`.

Content follows the current manuscript. Experiment clips come from slides
9–12 and 14–16 of `video_draft_v4.pptx`; execution-diversity images come from
the right side of `exp_half.pptx`. Asset mappings are recorded in
`docs/media-sources.json`.

Video speed-ups are encoded in the files, with browser rates scoped to each gallery.
Simulation clips are encoded at 2× their slide media. Following the October 2 review, the simulation task galleries use an additional 1.25× browser rate (1.5× for keyboard pressing), for 2.5× and 3× respectively; they carry no badge. Each source demo in the real-world gallery matches its deployment counterpart’s duration: 8 seconds for objects placing, keyboard pressing and bottles pumping (browser rate 0.75×), and 12 seconds for nut rotating (0.5×). These rates compensate for the 2× speed-up already encoded in the source files.
Physical-robot clips carry speed badges: 3× for objects placing, keyboard
pressing and bottles pumping, and 4× for nut rotating. The overview video uses
the current slide export with corrected speed and Oracle Intent labels.

The hero is a four-slide carousel (`assets/videos/hero/`, 1080p and 720p),
starting with nut rotating. Each clip is a real-world Wuji rollout with its
source demonstration burned in as a picture-in-picture; the demonstration is
sped up with its real clip so both start and end together (nut rotating 12 s
at 4×, the other tasks 8 s at 3×). `assets/js/full_screen_video.js` places the
HTML labels relative to the PiP, auto-advances when a clip ends, and handles
swipe, drag, trackpad and arrow-key navigation.

The method figure has three anchored first-use hints. They persist through hover, focus, and scrolling, and each disappears only after its own training or intent node is activated. Untried hints follow their nodes when the latent-intent view opens. SPIDER comparisons show red boxes around the Barrett pump and Allegro fallen bottle for the same interval as each failure caption. The boxes are measured for each 10 fps video frame and scale with the video.

The official site follows the anonymous site's content, layout, and media updates,
with the author names, Cornell University affiliation, paper link, acknowledgements,
citation, and website credits retained.
