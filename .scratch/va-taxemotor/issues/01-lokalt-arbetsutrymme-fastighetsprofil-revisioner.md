Status: ready-for-agent

## What to build

Build the local workspace and property profile foundation for the VA tax motor. The app should store all user data locally in the browser, support one shared workspace per installation, and persist property profiles with revision history. Profiles must use a stable UUID identity and support only the fields relevant to the chosen property type and selected services.

## Acceptance criteria

- [ ] The app stores user data locally in IndexedDB, with only non-domain UI preferences in localStorage.
- [ ] A property profile can be created, edited, saved, and reopened in the same workspace.
- [ ] Each profile has a stable UUID and revision history when data changes.
- [ ] The profile model supports bostadsfastighet, annan fastighet, and obebyggd fastighet.
- [ ] The profile model supports tomtyta, bostadsenheter, and service selections only when relevant.

## Blocked by

None - can start immediately
