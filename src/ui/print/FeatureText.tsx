import { content, printSheet } from "../../app/store";
import { ui } from "../../i18n/ui";
import { SourceTag } from "../SourceTag";
import { featureValueLabel } from "../sheet/parts";

/** The full text of species traits and class features, flowing over as many pages as needed. */
export function FeatureText() {
  const c = content.value;
  const s = printSheet.value;
  const ids = s ? [...s.traits, ...s.features].filter((id) => !s.hiddenFeatures.includes(id)) : [];
  if (!c || !s || ids.length === 0) return null;
  return (
    <section class="p-page">
      <h2 class="p-title">{ui("print.page.features")}</h2>
      <div class="p-flow">
        {ids.map((id) => (
          <article key={id}>
            <h3>
              {c.name(id)}
              <SourceTag id={id} />
            </h3>
            {c
              .text(id, "desc")
              ?.split("\n\n")
              .map((p) => (
                <p key={p}>{p}</p>
              ))}
            {s.featureValues[id] && (
              <p class="feature-values">{s.featureValues[id].map(featureValueLabel).join(" · ")}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
