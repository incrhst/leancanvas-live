"use client";

// The hero's two lines arrive the way they read. The first is built: each word
// rises into place like a floor going up, then holds. The question comes out of
// the fog a word at a time, and "you?" mists over for a beat, long enough to
// picture the business without you, before it clears.

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";

const BUILT = ["You", "built", "the", "business."];
const QUESTION = ["Would", "it", "run", "without"];

// The question waits until the first line has settled.
const QUESTION_AT = 1.05;
const YOU_AT = QUESTION_AT + QUESTION.length * 0.16 + 0.1;

export function HeroHeadline({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const still = reduceMotion ?? false;

  return (
    <h1 className={className}>
      <span className="block">
        {BUILT.map((word, i) => (
          // The clip box lets each word rise from below its own baseline, like a storey going up.
          <Fragment key={word}>
            <span className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
              <motion.span
                className="inline-block"
                initial={still ? false : { y: "105%" }}
                animate={{ y: 0 }}
                transition={{
                  delay: 0.15 + i * 0.12,
                  duration: 0.7,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
              >
                {word}
              </motion.span>
            </span>
            {i < BUILT.length - 1 && " "}
          </Fragment>
        ))}
      </span>
      {" "}
      <span className="block">
        {QUESTION.map((word, i) => (
          <motion.span
            key={word}
            className="inline-block"
            initial={still ? false : { opacity: 0, filter: "blur(12px)", y: 6 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{
              delay: QUESTION_AT + i * 0.16,
              duration: 0.9,
              ease: "easeOut",
            }}
          >
            {word}
          </motion.span>
        )).flatMap((el) => [el, " "])}
        <motion.span
          className="inline-block"
          initial={still ? false : { opacity: 0, filter: "blur(12px)", y: 6 }}
          animate={
            still
              ? undefined
              : {
                  // Arrives, fades into the haze, holds there, then comes back sharp.
                  opacity: [0, 1, 0.28, 0.28, 1],
                  filter: [
                    "blur(12px)",
                    "blur(0px)",
                    "blur(7px)",
                    "blur(7px)",
                    "blur(0px)",
                  ],
                  y: [6, 0, 0, 0, 0],
                }
          }
          transition={{
            delay: YOU_AT,
            duration: 3.4,
            times: [0, 0.22, 0.48, 0.74, 1],
            ease: "easeInOut",
          }}
        >
          you?
        </motion.span>
      </span>
    </h1>
  );
}
