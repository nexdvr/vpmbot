
const SESSION_KEY = "vpm_bot_session_id";

export function getSessionId(): string | null {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(SESSION_KEY);
}

export function createSessionId(): string {
    const sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
    return sessionId;
}

export function getOrCreateSessionId(): string {
    const existing = getSessionId();
    if (existing) return existing;
    return createSessionId();
}
