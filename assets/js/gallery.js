// Clip speed-ups are encoded in the files. Simulation task galleries add presentation
// speed; real-world source demos use the rate that matches each deployment clip's duration.
// Physical-robot and comparison clips use browser rate 1x.
// Pause clips outside the viewport.
document.addEventListener('DOMContentLoaded', () => {
  // One box per decoded 10 fps frame, in the original 1920 × 1080 coordinates.
  const evidenceTracks = {
    barrett: [
      [8.0,734,482,228,184],
      [8.1,738,480,228,184],
      [8.2,744,480,228,184],
      [8.3,750,480,228,184],
      [8.4,756,480,228,184],
      [8.5,762,484,228,184],
      [8.6,764,478,228,184],
      [8.7,766,478,228,184],
      [8.8,774,476,228,184],
      [8.9,776,474,228,184],
      [9.0,778,472,228,184],
      [9.1,778,468,228,184],
      [9.2,780,464,228,184],
      [9.3,780,460,228,184],
      [9.4,780,458,228,184],
      [9.5,784,456,228,184],
      [9.6,784,452,228,184],
      [9.7,784,448,228,184],
      [9.8,784,448,228,184],
      [9.9,786,444,228,184],
      [10.0,784,444,228,184],
      [10.1,786,444,228,184],
      [10.2,788,444,228,184],
      [10.3,788,446,228,184],
      [10.4,788,448,228,184],
      [10.5,790,450,228,184],
      [10.6,790,452,228,184],
      [10.7,792,450,228,184],
      [10.8,794,450,228,184],
      [10.9,796,448,228,184],
      [11.0,798,448,228,184],
      [11.1,796,446,228,184],
      [11.2,800,444,228,184],
      [11.3,800,444,228,184],
      [11.4,804,442,228,184],
      [11.5,806,442,228,184],
      [11.6,806,440,228,184],
      [11.7,808,440,228,184],
      [11.8,806,440,228,184],
      [11.9,804,440,228,184],
    ],
    allegro: [
      [9.5,638,598,328,272],
      [9.6,620,608,338,314],
      [9.7,608,628,340,364],
      [9.8,612,628,340,362],
      [9.9,616,628,338,362],
      [10.0,616,628,338,362],
      [10.1,612,626,340,364],
      [10.2,612,626,340,364],
      [10.3,612,626,340,364],
      [10.4,612,626,340,364],
      [10.5,612,626,340,364],
      [10.6,612,626,340,364],
      [10.7,612,626,340,364],
      [10.8,612,626,340,364],
      [10.9,612,626,340,364],
      [11.0,612,626,340,364],
      [11.1,612,626,340,364],
      [11.2,612,626,340,364],
      [11.3,612,626,340,364],
      [11.4,612,626,340,364],
      [11.5,612,626,340,364],
      [11.6,612,626,340,364],
      [11.7,612,626,340,364],
      [11.8,612,626,340,364],
      [11.9,612,626,340,364],
    ],
  };
  const videos = document.querySelectorAll('.gallery-video');
  const visibleVideos = new Set();
  const syncPlayback = () => {
    const navigating = document.documentElement.classList.contains('section-navigation-active');
    videos.forEach(video => {
      if (!navigating && visibleVideos.has(video)) video.play().catch(() => {});
      else video.pause();
    });
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({ target: video, isIntersecting }) => {
      if (isIntersecting) visibleVideos.add(video);
      else visibleVideos.delete(video);
    });
    syncPlayback();
  }, { threshold: 0.2 });
  document.addEventListener('section-navigation-change', syncPlayback);

  videos.forEach(video => {
    const rate = Number(video.dataset.playbackRate) || 1;
    video.defaultPlaybackRate = rate;
    video.playbackRate = rate;
    const cue = video.parentElement.querySelector('[data-cue-at]');
    if (cue) {
      const evidence = video.parentElement.querySelector('.comparison-evidence');
      const rect = evidence.querySelector('rect');
      const track = evidenceTracks[cue.dataset.track];
      const cueAt = Number(cue.dataset.cueAt);
      const hasFrameCallback = 'requestVideoFrameCallback' in video;
      let frameHandle = 0;
      const updateCue = (time = video.currentTime) => {
        const visible = time + 1e-6 >= cueAt;
        cue.hidden = !visible;
        evidence.toggleAttribute('hidden', !visible);
        if (!visible) return;
        // Use the box belonging to the displayed frame, including when seeking or looping.
        let frame = track[0];
        for (const point of track) {
          if (point[0] > time + 1e-6) break;
          frame = point;
        }
        ['x', 'y', 'width', 'height'].forEach((attr, i) => rect.setAttribute(attr, frame[i + 1]));
      };
      const stopFrames = () => {
        if (!frameHandle) return;
        if (hasFrameCallback) video.cancelVideoFrameCallback(frameHandle);
        else cancelAnimationFrame(frameHandle);
        frameHandle = 0;
      };
      const nextFrame = () => {
        if (hasFrameCallback) {
          frameHandle = video.requestVideoFrameCallback((_, metadata) => {
            frameHandle = 0;
            updateCue(metadata.mediaTime);
            if (!video.paused && !video.ended) nextFrame();
          });
        } else {
          frameHandle = requestAnimationFrame(() => {
            frameHandle = 0;
            updateCue();
            if (!video.paused && !video.ended) nextFrame();
          });
        }
      };
      video.addEventListener('play', () => { stopFrames(); nextFrame(); });
      video.addEventListener('pause', stopFrames);
      video.addEventListener('timeupdate', () => { if (!hasFrameCallback || video.paused) updateCue(); });
      video.addEventListener('seeked', () => updateCue());
      video.addEventListener('loadeddata', () => updateCue());
      video.addEventListener('emptied', () => { stopFrames(); cue.hidden = true; evidence.setAttribute('hidden', ''); });
      updateCue();
    }
    observer.observe(video);
  });
});
