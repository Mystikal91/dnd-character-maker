import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  type TransferReport,
  applyTransfer,
  currentCounts,
  downloadLinks,
  exportTransfer,
} from "../app/transfer";
import { transferDialog, transferInbox } from "../app/transferState";
import { importProgress } from "../app/userPacks";
import { type UiKey, ui } from "../i18n/ui";
import {
  type Bundle,
  DEFAULT_SECTIONS,
  SECTIONS,
  type Section,
  describeBundle,
  openSealed,
  openTransfer,
} from "../storage/bundle";
import { WrongPassphrase } from "../storage/crypto";

const close = () => {
  transferDialog.value = undefined;
  transferInbox.value = undefined;
};

function save(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Rows({
  counts,
  chosen,
  onChange,
  only,
}: {
  counts: Record<Section, number>;
  chosen: Set<Section>;
  onChange: (next: Set<Section>) => void;
  /** Show only the parts that have something. */
  only?: boolean;
}) {
  return (
    <ul class="plain transfer-rows">
      {SECTIONS.filter((s) => !only || counts[s] > 0).map((section) => (
        <li key={section}>
          <label class="check">
            <input
              type="checkbox"
              checked={chosen.has(section)}
              disabled={counts[section] === 0}
              onChange={(e) => {
                const next = new Set(chosen);
                if (e.currentTarget.checked) next.add(section);
                else next.delete(section);
                onChange(next);
              }}
            />
            <span>{ui(`transfer.sec.${section}` as UiKey, { n: counts[section] })}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function ExportPane() {
  const info = currentCounts();
  const [chosen, setChosen] = useState<Set<Section>>(
    () => new Set(DEFAULT_SECTIONS.filter((s) => info.counts[s] > 0 || s === "settings")),
  );
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const canShare = typeof navigator.canShare === "function" && typeof File !== "undefined";

  const make = async () => {
    setBusy(true);
    try {
      return await exportTransfer(chosen, pass);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p class="muted">{ui("transfer.exportHint")}</p>
      <Rows counts={info.counts} chosen={chosen} onChange={setChosen} />
      {chosen.has("links") && info.files.length > 0 && (
        <p class="muted">{ui("transfer.filesNote", { names: info.files.join(", ") })}</p>
      )}
      <label class="field">
        <span>{ui("transfer.passphrase")}</span>
        <input
          type="password"
          autocomplete="new-password"
          value={pass}
          onInput={(e) => setPass(e.currentTarget.value)}
        />
      </label>
      <p class="muted">{ui("transfer.passphraseHint")}</p>
      {chosen.has("deeplKey") && !pass && <p class="note">{ui("transfer.deeplWarn")}</p>}
      {chosen.size === 0 && <p class="muted">{ui("transfer.nothing")}</p>}
      <div class="quick-edit-actions">
        <button
          type="button"
          class="primary"
          disabled={busy || chosen.size === 0}
          onClick={async () => {
            const file = await make();
            save(file.name, file.text);
          }}
        >
          {ui("transfer.save")}
        </button>
        {canShare && (
          <button
            type="button"
            disabled={busy || chosen.size === 0}
            onClick={async () => {
              const file = await make();
              const shared = new File([file.text], file.name, { type: "application/json" });
              if (!navigator.canShare({ files: [shared] })) return save(file.name, file.text);
              try {
                await navigator.share({ files: [shared], title: file.name });
              } catch {
                // The person closed the share sheet: nothing to do.
              }
            }}
          >
            {ui("transfer.share")}
          </button>
        )}
      </div>
    </>
  );
}

function Report({ report }: { report: TransferReport }) {
  const progress = importProgress.value;
  const [downloading, setDownloading] = useState(false);
  const [left, setLeft] = useState(report.links);
  return (
    <div class="note" aria-live="polite">
      <p>
        <b>{ui("transfer.done")}</b>
      </p>
      <ul class="plain">
        {report.characters && (
          <li>
            {ui("transfer.report.characters", {
              added: report.characters.added,
              skipped: report.characters.skipped,
            })}
          </li>
        )}
        {report.packs !== undefined && <li>{ui("transfer.report.packs", { n: report.packs })}</li>}
        {report.edits !== undefined && <li>{ui("transfer.report.edits", { n: report.edits })}</li>}
        {report.settings && <li>{ui("transfer.report.settings")}</li>}
        {report.deeplKey && <li>{ui("transfer.report.deeplKey")}</li>}
        {report.translations !== undefined && (
          <li>{ui("transfer.report.translations", { n: report.translations })}</li>
        )}
        {report.unreadable > 0 && (
          <li>{ui("transfer.report.unreadable", { n: report.unreadable })}</li>
        )}
      </ul>
      {left.length > 0 && (
        <>
          <p>{ui("transfer.report.links", { n: left.length })}</p>
          <ul class="plain muted">
            {left.map((l) => (
              <li key={l.url}>{l.name}</li>
            ))}
          </ul>
          <button
            type="button"
            class="primary"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              await downloadLinks(left);
              setDownloading(false);
              setLeft([]);
            }}
          >
            {downloading && progress
              ? ui("packs.progress", { done: progress.done, total: progress.total })
              : ui("transfer.download")}
          </button>
        </>
      )}
    </div>
  );
}

function ImportPane() {
  const text = transferInbox.value;
  const [bundle, setBundle] = useState<Bundle | undefined>(undefined);
  const [sealed, setSealed] = useState(false);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<"wrong" | "unreadable" | undefined>(undefined);
  const [chosen, setChosen] = useState<Set<Section>>(new Set());
  const [report, setReport] = useState<TransferReport | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const take = useCallback((found: Bundle) => {
    const counts = describeBundle(found);
    setBundle(found);
    setChosen(new Set(SECTIONS.filter((s) => counts[s] > 0)));
  }, []);

  useEffect(() => {
    setBundle(undefined);
    setSealed(false);
    setError(undefined);
    setReport(undefined);
    if (!text) return;
    const opened = openTransfer(text);
    if (!opened) setError("unreadable");
    else if (opened.kind === "sealed") setSealed(true);
    else take(opened.bundle);
  }, [text, take]);

  const unlock = async () => {
    const opened = text ? openTransfer(text) : undefined;
    if (opened?.kind !== "sealed") return;
    try {
      take(await openSealed(opened.sealed, pass));
      setSealed(false);
      setError(undefined);
    } catch (e) {
      setError(e instanceof WrongPassphrase ? "wrong" : "unreadable");
    }
  };

  if (report) return <Report report={report} />;

  return (
    <>
      <p class="muted">{ui("transfer.importHint")}</p>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) transferInbox.value = await file.text();
        }}
      />
      {!text && (
        <button type="button" class="primary" onClick={() => picker.current?.click()}>
          {ui("transfer.choose")}
        </button>
      )}
      {error === "unreadable" && <p class="note">{ui("transfer.unreadable")}</p>}
      {sealed && (
        <>
          <p>{ui("transfer.sealed")}</p>
          <label class="field">
            <span>{ui("transfer.passphrase")}</span>
            <input
              type="password"
              autocomplete="current-password"
              value={pass}
              onInput={(e) => setPass(e.currentTarget.value)}
            />
          </label>
          {error === "wrong" && <p class="note">{ui("transfer.wrong")}</p>}
          <button type="button" class="primary" disabled={!pass} onClick={() => void unlock()}>
            {ui("transfer.open")}
          </button>
        </>
      )}
      {bundle && (
        <>
          <p class="muted">
            {ui("transfer.madeOn", { date: new Date(bundle.exportedAt).toLocaleDateString() })}
          </p>
          <Rows counts={describeBundle(bundle)} chosen={chosen} onChange={setChosen} only />
          {bundle.files && bundle.files.length > 0 && (
            <p class="muted">{ui("transfer.filesNote", { names: bundle.files.join(", ") })}</p>
          )}
          <button
            type="button"
            class="primary"
            disabled={busy || chosen.size === 0}
            onClick={async () => {
              setBusy(true);
              try {
                setReport(await applyTransfer(bundle, chosen));
              } finally {
                setBusy(false);
              }
            }}
          >
            {ui("transfer.doImport")}
          </button>
        </>
      )}
    </>
  );
}

/** The window for moving the app's data to another device: export on one, import on the other. */
export function TransferDialog() {
  const mode = transferDialog.value;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (mode && !node.open) node.showModal();
    if (!mode && node.open) node.close();
  }, [mode]);
  if (!mode) return null;
  return (
    <dialog ref={dialog} class="quick-edit transfer" onClose={close}>
      <h3>{ui("transfer.title")}</h3>
      <div class="segmented">
        {(["export", "import"] as const).map((m) => (
          <button
            type="button"
            key={m}
            class={mode === m ? "on" : ""}
            aria-pressed={mode === m}
            onClick={() => {
              transferDialog.value = m;
            }}
          >
            {ui(`transfer.${m}` as UiKey)}
          </button>
        ))}
      </div>
      {mode === "export" ? <ExportPane /> : <ImportPane />}
      <div class="quick-edit-actions">
        <button type="button" onClick={close}>
          {ui("transfer.close")}
        </button>
      </div>
    </dialog>
  );
}
