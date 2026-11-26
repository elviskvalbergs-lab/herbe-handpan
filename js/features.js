// The feature registry: every user-facing feature of the app, once.
//
// The help articles (help/en/*.md), the website's help pages and the tests
// all read names from here, so a rename happens in one place. Design and
// rules: docs/help-centre.md and "Help and docs" in CLAUDE.md.
//
// Rules, checked by tests/help.test.mjs:
//  - every feature has a help article (`help` is the article's id);
//  - `name` and every UI label is written exactly as the app shows it: the
//    text must appear in the app's source (js/*.js), so renaming something in
//    the app without renaming it here fails the tests;
//  - help articles never spell a name themselves: they write {{id}} and get
//    the name from here.
//
// Top-level names in this file are unique across js/ (one bundle scope).

export const FEATURE_FAMILIES = ['handpan', 'tongue-drum', 'kalimba', 'ocarina', 'flute', 'recorder'];
const FEATURE_PANS = ['handpan', 'tongue-drum', 'kalimba'];
const FEATURE_WINDS = ['ocarina', 'flute', 'recorder'];

// id: stable, never reused. name: as shown in the app. where: the screen it
// lives on, in words (for people and for an AI assistant). instruments: the
// families that have it. account: true when using it needs a free account.
// help: the article that explains it. link: the deep-link tab (js/links.js
// LINK_TABS) that opens it, when there is one.
export const FEATURES = [
  { id: 'setup',            name: 'What do you play?',     where: 'The first screen, and Add instrument',        instruments: FEATURE_FAMILIES, account: false, help: 'set-up-your-instrument' },
  { id: 'setup-listen',     name: 'Play my notes',         where: 'Set-up, and the scale list',                  instruments: FEATURE_FAMILIES, account: false, help: 'set-up-by-playing' },
  { id: 'setup-know',       name: 'I know my scale',       where: 'Set-up',                                      instruments: FEATURE_PANS,     account: false, help: 'set-up-by-scale' },
  { id: 'try',              name: 'Play something else',   where: 'My instruments',                              instruments: FEATURE_FAMILIES, account: false, help: 'try-without-saving' },
  { id: 'my-instruments',   name: 'My instruments',        where: 'The home screen once you have saved one',     instruments: FEATURE_FAMILIES, account: true,  help: 'my-instruments' },
  { id: 'chords',           name: 'Chords',                where: 'The first tab of every instrument',           instruments: FEATURE_FAMILIES, account: false, help: 'chords', link: 'chords' },
  { id: 'chords-all',       name: 'All chords',            where: 'Chords tab, the switch under the picture',    instruments: FEATURE_FAMILIES, account: false, help: 'chords', link: 'chords' },
  { id: 'chords-identify',  name: 'Tap notes',             where: 'Chords tab, the switch under the picture',    instruments: FEATURE_FAMILIES, account: false, help: 'identify-a-chord', link: 'chords' },
  { id: 'chords-filters',   name: 'Filters',               where: 'Chords tab',                                  instruments: FEATURE_FAMILIES, account: false, help: 'chords', link: 'chords' },
  { id: 'goes-with',        name: 'Goes well with',        where: 'Chords tab, on the chosen chord',             instruments: FEATURE_FAMILIES, account: false, help: 'goes-well-with', link: 'chords' },
  { id: 'ready-progressions', name: 'Progressions with this chord', where: 'The ⋯ of the chosen chord',          instruments: FEATURE_FAMILIES, account: true,  help: 'goes-well-with', link: 'chords' },
  { id: 'add-to-playlist',  name: 'Add to a playlist',     where: 'The bookmark on the chosen chord',            instruments: FEATURE_FAMILIES, account: true,  help: 'playlists', link: 'chords' },
  { id: 'speed',            name: 'Speed',                 where: 'The 1× button next to Play, and Settings',    instruments: FEATURE_FAMILIES, account: false, help: 'speed' },
  { id: 'songs',            name: 'Songs',                 where: 'The second tab of every instrument',          instruments: FEATURE_FAMILIES, account: false, help: 'songs-to-learn', link: 'songs' },
  { id: 'song-wait',        name: 'Wait for me',           where: 'A song',                                      instruments: FEATURE_FAMILIES, account: false, help: 'songs-to-learn' },
  { id: 'song-loop',        name: 'Loop from here',        where: 'A song',                                      instruments: FEATURE_FAMILIES, account: false, help: 'songs-to-learn' },
  { id: 'playlists',        name: 'Playlists',             where: 'The third tab of every instrument',           instruments: FEATURE_FAMILIES, account: true,  help: 'playlists', link: 'playlists' },
  { id: 'chord-sheet',      name: 'Paste a chord sheet',   where: 'Playlists tab, and the end of the Songs tab', instruments: FEATURE_FAMILIES, account: true,  help: 'chord-sheets', link: 'playlists' },
  { id: 'pan',              name: 'Pan',                   where: 'The last tab of a handpan you have not saved (Drum on a tongue drum, Keys on a kalimba)', instruments: FEATURE_PANS, account: false, help: 'change-your-notes', link: 'pan' },
  { id: 'set-up-tab',       name: 'Set up',                where: 'The last tab of an instrument in My instruments', instruments: FEATURE_FAMILIES, account: true, help: 'change-your-notes' },
  { id: 'notes',            name: 'Notes',                 where: 'The last tab of an ocarina, flute or recorder', instruments: FEATURE_WINDS,  account: false, help: 'fingerings', link: 'notes' },
  { id: 'listen',           name: 'Listen',                where: 'Chords tab, the switch under the picture',    instruments: FEATURE_FAMILIES, account: false, help: 'listen', link: 'listen' },
  { id: 'tuner',            name: 'Tuner',                 where: 'The tuning-fork button at the top of every screen', instruments: FEATURE_FAMILIES, account: false, help: 'tuner' },
  { id: 'save',             name: 'Save',                  where: 'On any instrument you have not saved yet',    instruments: FEATURE_FAMILIES, account: true,  help: 'accounts-and-saving' },
  { id: 'account',          name: 'Account and about',     where: 'Settings',                                    instruments: FEATURE_FAMILIES, account: true,  help: 'accounts-and-saving' },
  { id: 'offline',          name: 'Offline',               where: 'Settings, Account and about',                 instruments: FEATURE_FAMILIES, account: true,  help: 'offline' },
  { id: 'install',          name: 'Add Oakhum to your home screen', where: 'A banner on My instruments and Play something else', instruments: FEATURE_FAMILIES, account: false, help: 'install' },
  { id: 'share',            name: 'Share…',                where: 'The ⋯ menu of a saved instrument',            instruments: FEATURE_FAMILIES, account: true,  help: 'sharing' },
  { id: 'copy-link',        name: 'Copy link',             where: 'The ⋯ menu of an instrument',                 instruments: FEATURE_FAMILIES, account: false, help: 'sharing' },
  { id: 'share-song',       name: 'Share this song',       where: 'A song, at the top',                          instruments: FEATURE_FAMILIES, account: false, help: 'sharing' },
  { id: 'settings',         name: 'Settings',              where: 'The ⋯ menu, and the cog on My instruments',   instruments: FEATURE_FAMILIES, account: false, help: 'settings' },
  { id: 'makers',           name: 'For makers and shops',  where: 'Settings, Makers and shops',                  instruments: FEATURE_FAMILIES, account: true,  help: 'for-makers' },
  { id: 'feedback',         name: 'Send feedback',         where: 'Settings, Account and about',                 instruments: FEATURE_FAMILIES, account: false, help: 'contact' },
  { id: 'help',             name: 'Help',                  where: 'Settings, the ⋯ menu, and the ? next to many headings', instruments: FEATURE_FAMILIES, account: false, help: 'contact' },
];

// Words on buttons, tabs and rows that the help articles mention but that
// are not features of their own. Same rule: exactly as the app shows them.
export const UI_LABELS = {
  'know-key':        'I know my key',
  'not-sure-listen': 'Not sure · play my notes',
  'thats-all':       'That’s all my notes',
  'keep-this':       'Keep this',
  'first-chord':     'Play my first chord',
  'check-playing':   'Check it by playing',
  'add-instrument':  'Add instrument',
  'edit-instrument': 'Edit instrument',
  'remove-instrument': 'Remove instrument',
  'own-copy':        'Make my own copy',
  'move-notes':      'Move notes',
  'drum-tab':        'Drum',
  'keys-tab':        'Keys',
  'show-all':        'Show all',
  'scale-btn':       'Scale',
  'play-scale':      'Play the scale',
  'new-playlist':    'New playlist',
  'songs-popular':   'Popular',
  'songs-countries': 'Countries',
  'almost-fit':      'Almost fit: one note missing',
  'back-to-start':   'Back to the start',
  'print-tab':       'Print the tab',
  'tab-view':        'Tab',
  'notes-view':      'Notes',
  'level-chord':     'Chord',
  'level-roots':     'Roots',
  'level-arpeggio':  'Arpeggio',
  'level-groove':    'Groove',
  'tempo':           'Tempo',
  'order':           'Order',
  'practice':        'Practice',
  'send-code':       'Send code',
  'not-now':         'Not now',
  'sign-in':         'Sign in',
  'sign-out':        'Sign out',
  'export':          'Export my data',
  'delete-account':  'Delete account',
  'check-updates':   'Check for updates',
  'theme':           'Theme',
  'note-names':      'Note names',
  'note-style':      'Note style',
  'ring-orientation': 'Ring orientation',
  'finger-labels':   'Finger labels in holes',
  'which-finger':    'Which finger is which',
  'send-recording':  'Send us the recording',
  'auto-play-secs':  'Seconds per chord in auto-play',
  'create-maker':    'Create your maker page',
};

// Which article the app opens for "Help with this screen" (js/app.js
// helpScreenKey gives the key). Every value is an article id.
export const HELP_SCREENS = {
  home: 'my-instruments',
  setup: 'set-up-your-instrument',
  try: 'try-without-saving',
  chords: 'chords',
  identify: 'identify-a-chord',
  listen: 'listen',
  pan: 'change-your-notes',
  notes: 'fingerings',
  playlists: 'playlists',
  songs: 'songs-to-learn',
  playlist: 'playlists',
  progression: 'playlists',
  song: 'songs-to-learn',
  practice: 'playlists',
  settings: 'settings',
  makers: 'for-makers',
};

/** The name of a feature or the text of a UI label, as the app shows it. */
export function featureName(id) {
  return FEATURES.find(f => f.id === id)?.name ?? UI_LABELS[id] ?? null;
}
