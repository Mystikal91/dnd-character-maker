import { useRef, useState } from "preact/hooks";
import { leavePage } from "../app/navigation";
import { content } from "../app/store";
import {
  exportPack,
  importAuroraFiles,
  importAuroraUrl,
  importPackFile,
  importProgress,
  importReport,
  packError,
  removeUserPack,
  userPacks,
} from "../app/userPacks";
import { type UiKey, ui } from "../i18n/ui";
import type { UserPackRecord } from "../storage/packs";

/** How many entries of each kind a pack has, e.g. `3 spell, 2 item`. */
function summary(record: UserPackRecord): string {
  const counts = new Map<string, number>();
  for (const entry of record.pack.entries)
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, n]) => `${n} ${kind}`).join(", ");
}

/** The content packs the user added: what they hold, where they came from, and how to remove them. */
export function PacksPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const auroraInput = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const progress = importProgress.value;
  const report = importReport.value;
  const packs = userPacks.value;
  const error = packError.value;
  // The built-in content is spread over several files: count entries per pack id.
  const totals = new Map<string, number>();
  for (const p of content.value?.packs ?? []) {
    if (p.manifest.ruleset === "custom") continue;
    totals.set(p.manifest.id, (totals.get(p.manifest.id) ?? 0) + p.entries.length);
  }
  const builtIn = [...totals.entries()];

  const remove = (record: UserPackRecord) => {
    if (confirm(ui("packs.removeConfirm", { name: record.name }))) void removeUserPack(record.id);
  };

  return (
    <article class="card packs">
      <button type="button" class="secondary" onClick={leavePage}>
        {ui("credits.back")}
      </button>
      <h2>{ui("packs.title")}</h2>
      <p>{ui("packs.intro")}</p>
      <p class="note">{ui("packs.rights")}</p>

      <h3>{ui("packs.builtIn")}</h3>
      <ul class="plain">
        {builtIn.map(([id, count]) => (
          <li key={id}>
            <b>{id.toUpperCase()}</b> · {count} {ui("packs.entries")}
          </li>
        ))}
      </ul>

      <h3>{ui("packs.yours")}</h3>
      {packs.length === 0 ? (
        <p class="muted">{ui("packs.none")}</p>
      ) : (
        <ul class="plain pack-list">
          {packs.map((record) => (
            <li key={record.id} class="pack">
              <div>
                <b>{record.name}</b>
                <span class={`pack-tag ${record.origin}`}>
                  {ui(`packs.origin.${record.origin}` as UiKey)}
                </span>
                <div class="muted">{summary(record)}</div>
              </div>
              <div class="pack-actions">
                {record.origin === "homebrew" && (
                  <button type="button" onClick={() => exportPack(record)}>
                    {ui("bar.export")}
                  </button>
                )}
                <button type="button" class="danger" onClick={() => remove(record)}>
                  {ui("packs.remove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>{ui("packs.add")}</h3>
      <div class="pack-actions">
        <button type="button" onClick={() => fileInput.current?.click()}>
          {ui("packs.import")}
        </button>
        <button type="button" class="primary" onClick={() => auroraInput.current?.click()}>
          {ui("packs.importAurora")}
        </button>
        <input
          ref={auroraInput}
          type="file"
          accept=".xml,.index,.txt,text/xml,application/xml,text/plain"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = "";
            if (files.length > 0) void importAuroraFiles(files);
          }}
        />
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void importPackFile(file);
          }}
        />
      </div>
      <form
        class="pack-address"
        onSubmit={(e) => {
          e.preventDefault();
          if (address.trim() && !progress) void importAuroraUrl(address);
        }}
      >
        <input
          type="url"
          value={address}
          placeholder="https://"
          aria-label={ui("packs.addressLabel")}
          onInput={(e) => setAddress(e.currentTarget.value)}
        />
        <button type="submit" class="primary" disabled={!address.trim() || Boolean(progress)}>
          {ui("packs.addressGo")}
        </button>
      </form>
      <p class="muted">{ui("packs.auroraHint")}</p>
      {progress && (
        <p class="note" aria-live="polite">
          {ui("packs.progress", { done: progress.done, total: progress.total })}
        </p>
      )}
      {report && (
        <div class="note" aria-live="polite">
          {report.added > 0 ? (
            <p>{ui("packs.report", { name: report.name, n: report.added })}</p>
          ) : (
            <p>{ui("packs.reportNothing")}</p>
          )}
          {report.failed > 0 && <p>{ui("packs.reportFailed", { n: report.failed })}</p>}
          {report.truncated && <p>{ui("packs.reportTruncated")}</p>}
          {report.duplicates > 0 && <p>{ui("packs.reportDuplicates", { n: report.duplicates })}</p>}
          {report.unsupported > 0 && <p>{ui("packs.reportRules", { n: report.unsupported })}</p>}
          {Object.keys(report.skipped).length > 0 && (
            <p>
              {ui("packs.reportSkipped", {
                list: Object.entries(report.skipped)
                  .map(([type, n]) => `${type} ×${n}`)
                  .join(", "),
              })}
            </p>
          )}
        </div>
      )}
      {error && (
        <p class="note" role="alert">
          {ui(error === "exists" ? "packs.exists" : "packs.invalid")}
        </p>
      )}
    </article>
  );
}
