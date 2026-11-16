# Oakhum Text

The app's typeface. The Oakhum brand book asks for Lato (Regular / Medium) for UI and body text.

- **Source:** Lato 2.0 (version 2.983) by Łukasz Dziedzic, from the `lato-font@3.0.0` npm package
  (https://www.npmjs.com/package/lato-font, files `fonts/lato-{normal,medium,semibold,bold}/*.woff2`).
  Lato 2.0 is used instead of Google Fonts' Lato because only 2.0 has the Medium and Semibold weights.
- **Changes:** the files are subset to Latin (U+0000–024F, punctuation, arrows, ♭ ♮ ♯) with fontTools, which
  takes each one from about 180 KB to 47 KB. A subset is a "Modified Version" under the SIL Open Font
  License and "Lato" is a Reserved Font Name, so the family is renamed **Oakhum Text**.
- **Licence:** SIL Open Font License 1.1, see `OFL.txt` (copied from https://github.com/google/fonts/blob/main/ofl/lato/OFL.txt).

| File | Weight | Used for |
| --- | --- | --- |
| `oakhum-text-400.woff2` | 400 Regular | body, meta |
| `oakhum-text-500.woff2` | 500 Medium | tab labels, buttons |
| `oakhum-text-600.woff2` | 600 Semibold | titles |
| `oakhum-text-700.woff2` | 700 Bold | numerals on diagrams |
