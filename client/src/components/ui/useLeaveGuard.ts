import { useEffect, useRef } from 'react';
import { useBeforeUnload, useBlocker, useNavigate } from 'react-router';

/** Guard page links and browser Back as well as refresh during an active save. */
export function useLeaveGuard(message?: string) {
  const navigate = useNavigate();
  const busy = useRef(false);
  const saved = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !saved.current && currentLocation.pathname.replace(/\/+$/, '') !== nextLocation.pathname.replace(/\/+$/, '') && (busy.current || Boolean(message))
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (busy.current || (message && !window.confirm(message))) blocker.reset();
    else blocker.proceed();
  }, [blocker, message]);

  useBeforeUnload((event) => {
    if (!saved.current && (busy.current || message)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  return {
    onPersistingChange: (value: boolean) => { busy.current = value; },
    onSaved: (to: string) => {
      saved.current = true;
      busy.current = false;
      void navigate(to, { replace: true });
    },
  };
}
