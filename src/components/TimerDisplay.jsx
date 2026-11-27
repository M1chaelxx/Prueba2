import { memo, useEffect, useRef } from 'react';
import { fmtTimer } from '../utils/timer';

const TimerDisplay = memo(function TimerDisplay({ elapsed, startAt, running, large, className }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!running) {
      if (ref.current) ref.current.textContent = fmtTimer(elapsed);
      return;
    }
    let raf;
    const tick = () => {
      if (ref.current) ref.current.textContent = fmtTimer(elapsed + (Date.now() - startAt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [elapsed, startAt, running]);

  return (
    <span ref={ref} className={`timer-display${running ? ' run' : ''}${large ? ' large' : ''} ${className || ''}`}>
      {fmtTimer(elapsed)}
    </span>
  );
});

export default TimerDisplay;
