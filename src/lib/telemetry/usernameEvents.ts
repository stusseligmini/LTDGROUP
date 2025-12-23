// Simple telemetry hooks (console-based); replace with real analytics later
export type UsernameEventType = 'lookup' | 'availability' | 'register';

interface UsernameEventPayload {
  type: UsernameEventType;
  username: string;
  success?: boolean;
  error?: string;
  ts: number;
}

function emit(payload: UsernameEventPayload) {
  if (process.env.NODE_ENV !== 'production') {
     
    console.debug('[username-event]', payload);
  }
  // Future: send to analytics endpoint
}

export function trackUsernameLookup(username: string, error?: string) {
  emit({ type: 'lookup', username, error, ts: Date.now() });
}

export function trackUsernameAvailability(username: string, available: boolean, error?: string) {
  emit({ type: 'availability', username, success: available, error, ts: Date.now() });
}

export function trackUsernameRegistration(username: string, success: boolean, error?: string) {
  emit({ type: 'register', username, success, error, ts: Date.now() });
}
