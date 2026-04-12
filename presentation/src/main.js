import Reveal from 'reveal.js';
import Markdown from 'reveal.js/plugin/markdown';
import Highlight from 'reveal.js/plugin/highlight';
import Notes from 'reveal.js/plugin/notes';
import Zoom from 'reveal.js/plugin/zoom';
import 'reveal.js/reveal.css';
import 'reveal.js/theme/black.css';
import 'reveal.js/plugin/highlight/monokai.css';
import './slides.css';

const deck = new Reveal({
  hash: true,
  slideNumber: 'c/t',
  width: 1280,
  height: 720,
  margin: 0.04,
  transition: 'fade',
  backgroundTransition: 'fade',
  autoAnimate: true,
  autoAnimateEasing: 'ease',
  autoAnimateDuration: 0.7,
  center: false,
  controls: true,
  progress: true,
  plugins: [Markdown, Highlight, Notes, Zoom],
});

window.Reveal = deck;
deck.initialize();
