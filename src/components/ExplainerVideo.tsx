"use client";

// The explainer: a minute on keeping everyone aligned on decisions, shown on the app itself with a UK narrator.
// Rendered from the parametric Remotion project (qrtick-promo-video/projects/criticaldash,
// videos/criticaldash-in-a-minute.json). Nothing loads until someone presses play, and then only the
// cut that fits the screen: 9:16 on phones, 16:9 everywhere else.

import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "lucide-react";

const CUTS = {
  tall: { src: "/video/criticaldash-in-a-minute-9x16.mp4", poster: "/video/criticaldash-in-a-minute-9x16.jpg" },
  wide: { src: "/video/criticaldash-in-a-minute-16x9.mp4", poster: "/video/criticaldash-in-a-minute-16x9.jpg" },
};

// Same breakpoint as Tailwind's sm, which switches the frame's shape.
const TALL = "(max-width: 639px)";
const cutFor = (tall: boolean) => (tall ? CUTS.tall : CUTS.wide);

export function ExplainerVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const play = () => {
    const video = ref.current;
    if (!video) return;
    const cut = cutFor(window.matchMedia(TALL).matches);
    video.src = cut.src;
    video.poster = cut.poster;
    setStarted(true);
    void video.play().catch(() => {
      // Autoplay with sound refused: the controls are showing, so a second tap plays it.
    });
  };

  // Once it has started, crossing the breakpoint swaps to the other cut at the same moment,
  // still playing if it was. The frame changes shape at the same width, so the old cut
  // would otherwise be cropped.
  useEffect(() => {
    if (!started) return;
    const query = window.matchMedia(TALL);
    const swap = () => {
      const video = ref.current;
      if (!video) return;
      const cut = cutFor(query.matches);
      if (video.currentSrc.endsWith(cut.src)) return;
      const at = video.currentTime;
      const wasPlaying = !video.paused && !video.ended;
      video.poster = cut.poster;
      // preload="none" only holds off the first load; past play, fetch the new cut straight away.
      video.preload = "auto";
      video.src = cut.src;
      video.load();
      video.addEventListener(
        "loadedmetadata",
        () => {
          video.currentTime = at;
          if (wasPlaying) void video.play().catch(() => {});
        },
        { once: true },
      );
    };
    query.addEventListener("change", swap);
    return () => query.removeEventListener("change", swap);
  }, [started]);

  return (
    <div className="relative mx-auto w-full max-w-[420px] sm:max-w-none aspect-[9/16] sm:aspect-video overflow-hidden rounded-3xl border border-line bg-[#0F3A33] shadow-lg">
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        controls={started}
        playsInline
        preload="none"
        aria-label="A one-minute explainer on why CriticalDash matters"
      >
        <track kind="captions" src="/video/criticaldash-in-a-minute.vtt" srcLang="en-GB" label="English" default />
      </video>

      {!started && (
        <button
          type="button"
          onClick={play}
          className="group absolute inset-0 flex items-center justify-center focus:outline-none"
          aria-label="Play the one-minute explainer, with sound"
        >
          <picture className="absolute inset-0">
            <source media="(max-width: 639px)" srcSet={CUTS.tall.poster} />
            <img src={CUTS.wide.poster} alt="" className="h-full w-full object-cover" />
          </picture>
          <span className="relative inline-flex min-h-[56px] items-center gap-3 rounded-full bg-incrementic-red px-7 font-display font-semibold text-lg text-white shadow-xl transition-colors group-hover:bg-[#D93D34] group-focus-visible:ring-4 group-focus-visible:ring-white/80">
            <PlayIcon className="h-5 w-5 fill-current" aria-hidden="true" />
            Play the minute
            <span className="font-sans font-normal text-white/85 tabular-nums">0:55</span>
          </span>
        </button>
      )}
    </div>
  );
}
