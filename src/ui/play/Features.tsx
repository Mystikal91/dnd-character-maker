import { useState } from "preact/hooks";
import { content, sheet } from "../../app/store";
import type { DerivedSheet } from "../../engine/derive";
import type { ClassResource } from "../../engine/resources";
import { ui } from "../../i18n/ui";
import { EditPencil } from "../QuickEdit";
import { FeatureValues, Panel, Paragraphs } from "../sheet/parts";
import { ResourceControl, recoveryLabel } from "./ResourceControl";
import { FeaturesIcon, MagicIcon, ProfileIcon } from "./icons";

type Origin = "class" | "species" | "feat";

const ORIGINS: {
  origin: Origin;
  title: "play.featuresClass" | "play.featuresSpecies" | "play.featuresFeats";
}[] = [
  { origin: "class", title: "play.featuresClass" },
  { origin: "species", title: "play.featuresSpecies" },
  { origin: "feat", title: "play.featuresFeats" },
];

const ICON = { class: FeaturesIcon, species: ProfileIcon, feat: MagicIcon } as const;

/** The features, traits and feats a character shows at the table, by where they come from. */
export function shownFeatures(
  c: NonNullable<typeof content.value>,
  s: DerivedSheet,
): Record<Origin, string[]> {
  const seen = new Set<string>();
  const pick = (ids: string[]) =>
    ids
      .filter((id) => {
        if (seen.has(id) || !c.text(id, "desc") || s.hiddenFeatures.includes(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((a, b) => c.name(a).localeCompare(c.name(b)));
  // A feature that is a class feature stays there, even when a trait lists it too.
  const features = pick(s.features);
  const traits = pick(s.traits);
  const feats = pick(s.feats);
  return { class: features, species: traits, feat: feats };
}

/** The first paragraph of a text, for the line under the name of a closed card. */
const preview = (text: string | undefined) => (text ?? "").split("\n\n")[0] ?? "";

/** One feature: its name and what kind of use it is, its uses to tick off, and its text on demand. */
function FeatureCard({
  id,
  origin,
  resource,
}: {
  id: string;
  origin: Origin;
  resource: ClassResource | undefined;
}) {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const Icon = ICON[origin];
  const text = c.text(id, "desc");
  const activation = c.index.get(id)?.data.activation;
  const action =
    activation === "action" || activation === "bonus" || activation === "reaction"
      ? ui(`feature.activation.${activation}`)
      : undefined;

  return (
    <li
      class="play-card feat-card"
      data-origin={origin}
      data-activation={action ? activation : undefined}
    >
      <details>
        <summary class="feat-summary">
          <span class="card-badge" aria-hidden="true">
            <Icon />
          </span>
          <span class="card-head">
            <b class="feat-name">{c.name(id)}</b>
            <span class="feat-tags">
              {action && <span class="card-tag">{action}</span>}
              {resource && <span class="card-tag">{recoveryLabel(resource)}</span>}
            </span>
            <span class="feat-preview">{preview(text)}</span>
          </span>
          <span class="feat-chevron" aria-hidden="true" />
        </summary>
        <div class="feat-body">
          <Paragraphs text={text} />
          <FeatureValues values={s.featureValues[id]} />
          <EditPencil id={id} />
        </div>
      </details>
      {resource && (
        <div class="feat-uses">
          <ResourceControl r={resource} />
        </div>
      )}
    </li>
  );
}

/** Everything the character has from species, class and feats, to read at the table when it comes up. */
export function PlayFeatures() {
  const c = content.value;
  const s = sheet.value;
  const [query, setQuery] = useState("");
  if (!c || !s) return null;
  const groups = shownFeatures(c, s);
  const total = groups.class.length + groups.species.length + groups.feat.length;
  if (total === 0) return null;
  const byEntry = new Map(s.resources.flatMap((r) => (r.entry ? [[r.entry, r] as const] : [])));
  const needle = query.trim().toLowerCase();
  const matches = (id: string) => !needle || c.name(id).toLowerCase().includes(needle);

  return (
    <Panel title={ui("play.features")} className="features-panel">
      {total > 6 && (
        <input
          type="search"
          class="feat-search"
          value={query}
          placeholder={ui("play.featuresSearch")}
          aria-label={ui("play.featuresSearch")}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      )}
      {ORIGINS.map(({ origin, title }) => {
        const ids = groups[origin].filter(matches);
        if (ids.length === 0) return null;
        return (
          <section class="card-group" key={origin}>
            <header class="card-group-head">
              <h4>{ui(title)}</h4>
              <small class="muted">{ids.length}</small>
            </header>
            <ul class="plain card-list">
              {ids.map((id) => (
                <FeatureCard key={id} id={id} origin={origin} resource={byEntry.get(id)} />
              ))}
            </ul>
          </section>
        );
      })}
    </Panel>
  );
}
