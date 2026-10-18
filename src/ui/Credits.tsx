import { showView } from "../app/navigation";
import { content } from "../app/store";
import { ui } from "../i18n/ui";

const REPO_URL = "https://github.com/Mystikal91/dnd-character-maker";

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Attribution and licenses. The SRD attribution text is required by its license and stays in English. */
export function Credits() {
  const attributions = [...new Set(content.value?.packs.map((p) => p.manifest.attribution))];

  return (
    <article class="card credits">
      <button type="button" class="secondary" onClick={() => showView("edit")}>
        {ui("credits.back")}
      </button>
      <h2>{ui("credits.title")}</h2>

      <h3>{ui("credits.rules")}</h3>
      <p>{ui("credits.rulesIntro")}</p>
      {attributions.map((text) => (
        <blockquote key={text} lang="en">
          {text}
        </blockquote>
      ))}

      <h3>{ui("credits.data")}</h3>
      <p>
        {ui("credits.dataText")}{" "}
        <ExternalLink href="https://github.com/5e-bits/5e-database">
          5e-bits/5e-database
        </ExternalLink>
      </p>

      <h3>{ui("credits.design")}</h3>
      <p>{ui("credits.designText")}</p>
      <ul>
        <li>
          <ExternalLink href="https://www.dmsguild.com/en/product/232835/class-character-sheets-the-bundle">
            Class Character Sheets: The Bundle
          </ExternalLink>
          {" — Emmet Byrne"}
        </li>
      </ul>

      <h3>{ui("credits.fonts")}</h3>
      <p>{ui("credits.fontsText")}</p>

      <h3>{ui("credits.software")}</h3>
      <p>
        {ui("credits.softwareText")}{" "}
        <ExternalLink href={REPO_URL}>{ui("credits.source")}</ExternalLink>
      </p>
    </article>
  );
}
