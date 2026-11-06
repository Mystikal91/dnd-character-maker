/** How many lines are drawn: more than any frame has room for; what does not fit is cut off. */
const LINES = 45;

/**
 * Lines to write on, as many as the frame has room for. They are real borders, cut off by the room
 * there is, because a repeating gradient prints as thick bars in Firefox.
 */
export function RuledArea() {
  return (
    <div class="p-ruled-area" aria-hidden="true">
      {Array.from({ length: LINES }, (_, i) => (
        <div class="p-rule" key={`rule-${i + 1}`} />
      ))}
    </div>
  );
}
