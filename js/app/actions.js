// The action registry: every control carries data-action="…", and the
// screen that owns the control registers what the name does. One listener per
// event (js/app/main.js) looks the name up. Handlers are (el, e, action):
// el is the element with data-action, e the DOM event, action its name.
// A key may list several names separated by commas ('a, b') for one handler.

const ACTIONS = Object.create(null);        // click
const EARLY_ACTIONS = Object.create(null);  // click, tried before a menu row closes its menu
const CHANGE_ACTIONS = Object.create(null); // change (selects, checkboxes, file inputs)

// A name registered twice stops the app at load, so it can never reach a user.
function registerActions(handlers, table = ACTIONS) {
  for (const [key, fn] of Object.entries(handlers)) {
    for (const name of key.split(/,\s*/)) {
      const clash = table === CHANGE_ACTIONS ? table[name] : (ACTIONS[name] || EARLY_ACTIONS[name]);
      if (clash) throw new Error(`Action "${name}" is registered twice`);
      table[name] = fn;
    }
  }
}

// Runs one action; false when no handler has that name.
function runAction(name, el, e, table = ACTIONS) {
  const fn = table[name];
  if (!fn) return false;
  fn(el, e, name);
  return true;
}
