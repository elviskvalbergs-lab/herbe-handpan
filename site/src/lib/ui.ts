// Shared class strings, so every button and section looks the same.
export const container = "mx-auto w-full max-w-page px-4 sm:px-8";

const pill = "inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-6 py-3 text-[17px] font-semibold no-underline transition-colors";
/** On cream: Oak Olive with cream text. */
export const btnPrimary = `${pill} bg-primary text-on-primary hover:bg-primary-hover hover:text-on-primary`;
/** On cream: an outline. */
export const btnSecondary = `${pill} border border-border-strong text-text hover:border-text hover:text-text`;
/** On a picture (the hero): an outline with a cream fill, so it reads over anything. */
export const btnOnPicture = `${pill} border border-text bg-bg text-text hover:bg-surface hover:text-text`;
/** On cream, the smaller dark pill: Ink with cream text (the home header's "Open the app"). */
export const btnInk = `${pill} bg-dark text-on-dark hover:bg-dark-raised hover:text-on-dark`;
/** On ink: the clay call to action. */
export const btnCta = `${pill} bg-cta text-on-cta hover:bg-cta-hover hover:text-on-cta`;
/** On ink: an outline. */
export const btnOnDark = `${pill} border border-dark-line text-on-dark hover:border-on-dark hover:text-on-dark`;

export const h2 = "text-[clamp(30px,4vw,44px)] font-semibold leading-[1.1] tracking-[-0.02em]";
export const h3 = "text-[21px] font-semibold leading-snug";
