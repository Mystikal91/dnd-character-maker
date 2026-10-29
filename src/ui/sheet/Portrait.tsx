import { useRef, useState } from "preact/hooks";
import { character, updateCharacter } from "../../app/store";
import { ui } from "../../i18n/ui";
import { PortraitEditor } from "./PortraitEditor";

/**
 * The portrait medallion beside the name: tap it to choose a picture, then cut out the part to
 * keep in a window (see `PortraitEditor`). The picture is kept small, on the device. A small
 * cross takes it away. Without a picture the medallion shows the first letter of the name.
 */
export function Portrait() {
  const ch = character.value;
  const picker = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<ImageBitmap | undefined>(undefined);
  const initial = ch.name.trim().charAt(0).toUpperCase() || "?";

  const close = () => {
    editing?.close();
    setEditing(undefined);
  };

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
            const bitmap = await createImageBitmap(file);
            editing?.close();
            setFailed(false);
            setEditing(bitmap);
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
      {editing && (
        <PortraitEditor
          bitmap={editing}
          onUse={(picture) => {
            updateCharacter((d) => {
              d.portrait = picture;
            });
            close();
          }}
          onCancel={close}
          onOther={() => {
            close();
            picker.current?.click();
          }}
        />
      )}
    </div>
  );
}
