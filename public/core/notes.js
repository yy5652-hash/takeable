// Reads NYU section notes for two things: whether attendance is live, and restrictions.

const SYNC = /synchronous attendance is required|via zoom|meets? (?:weekly )?(?:online )?via|live online/i;
const ASYNC = /\basynchronous(?:ly)?\b/i;

// Phrases that mean "a human should check this applies to you". Quoted, never guessed.
const RESTRICTION =
  /\bopen to\b|\bonly\b|standing or higher|approval required|\bpermission\b|do not enroll if|does not count|\brestricted\b|pre-?requisite/i;
const NOT_RESTRICTIVE = /open to all\b|first[- ]years? and above|non-?majors may register/i;

export function readNote(text = "") {
  const note = text.trim();
  let async = null;
  if (SYNC.test(note)) async = false;
  else if (ASYNC.test(note)) async = true;

  const restrictions = sentences(note).filter((s) => RESTRICTION.test(s) && !NOT_RESTRICTIVE.test(s));
  return { async, restrictions };
}

export function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}
