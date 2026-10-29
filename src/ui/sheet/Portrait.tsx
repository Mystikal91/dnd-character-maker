import { useRef, useState } from "preact/hooks";
import { portraitFromFile } from "../../app/portrait";
import { character, updateCharacter } from "../../app/store";
import { ui } from "../../i18n/ui";

/**
 * The portrait medallion beside the name: tap it to choose a picture (cut square from the middle
 * and kept small on the device), and a small cross takes it away. Without a picture it shows the
 * first letter of the name.
 */
export function Portrait() {
  const ch = character.value;
  const picker = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const initial = ch.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div class="portrait">
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          try {
            const picture = await portraitFromFile(file);
            setFailed(false);
            updateCharacter((d) => {
              d.portrait = picture;
            });
          } catch {
            setFailed(true);
          }
        }}
      />
      <button
        type="button"
        class="portrait-frame"
        aria-label={ch.portrait ? ui("portrait.change") : ui("portrait.add")}
        title={ch.portrait ? ui("portrait.change") : ui("portrait.add")}
        onClick={() => picker.current?.click()}
      >
        <span class="portrait-face">
          {ch.portrait ? (
            <img src={ch.portrait} alt="" />
          ) : (
            <span class="portrait-initial" aria-hidden="true">
              {initial}
            </span>
          )}
        </span>
      </button>
      {ch.portrait && (
        <button
          type="button"
          class="portrait-remove"
          aria-label={ui("portrait.remove")}
          title={ui("portrait.remove")}
          onClick={() =>
            updateCharacter((d) => {
              d.portrait = undefined;
            })
          }
        >
          ✕
        </button>
      )}
      {failed && (
        <span class="portrait-error" role="alert">
          {ui("portrait.failed")}
        </span>
      )}
    </div>
  );
}
