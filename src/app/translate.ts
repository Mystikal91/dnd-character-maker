import { effect } from "@preact/signals";
import { autoTarget, canTranslate, loadTranslationCache } from "../translate/auto";
import { language } from "./language";

// The language machine translation writes in: the app's own, unless it is English.
effect(() => {
  autoTarget.value = canTranslate(language.value) ? language.value : undefined;
});

void loadTranslationCache();
