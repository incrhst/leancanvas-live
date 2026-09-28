/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        ink: token("ink"),
        muted: token("muted"),
        subtle: token("subtle"),
        line: token("line"),
        accent: token("accent"),
        "accent-ink": token("accent-ink"),
        "accent-soft": token("accent-soft"),
        note: {
          yellow: { DEFAULT: token("note-yellow"), edge: token("note-yellow-edge") },
          pink: { DEFAULT: token("note-pink"), edge: token("note-pink-edge") },
          blue: { DEFAULT: token("note-blue"), edge: token("note-blue-edge") },
          green: { DEFAULT: token("note-green"), edge: token("note-green-edge") },
        },
      },
    },
  },
  plugins: [],
};
