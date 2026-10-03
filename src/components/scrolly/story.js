import scrollama from 'scrollama';
import { state } from '../../state.js';

export function initScrollytelling(onStepEnterCallback) {
  const scroller = scrollama();

  scroller
    .setup({
      step: '.step',
      offset: 0.55,
      debug: false
    })
    .onStepEnter(response => {
      const stepIndex = response.index;
      state.setActiveStep(stepIndex);

      // Add active styling to step cards
      document.querySelectorAll('.step').forEach((el, i) => {
        if (i === stepIndex) {
          el.classList.add('is-active');
        } else {
          el.classList.remove('is-active');
        }
      });

      if (onStepEnterCallback) {
        onStepEnterCallback(stepIndex);
      }
    });

  // Handle window resizing
  window.addEventListener('resize', scroller.resize);

  return scroller;
}
