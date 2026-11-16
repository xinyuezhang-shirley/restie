/**
 * What Rusty is doing this moment (the room's subtitle), for his chat to
 * mention ("I was just painting by the window"). Home keeps it current.
 * A plain module value: no re-renders, read when a message is sent.
 */
export const rustyNow = { doing: '', at: 0 };

export function setRustyNow(doing: string) {
  rustyNow.doing = doing;
  rustyNow.at = Date.now();
}
