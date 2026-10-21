# InfoSuite client bridge

This module is the adapter between the original World of ClaudeCraft client and the InfoSuite-controlled game session. It does not implement game mechanics; it calls the existing Base44 runtime functions.

## Contract

- `launchSession`: exchange a single-use InfoSuite-signed ticket for short-lived runtime access and resume tokens.
- `studentRuntime?action=read`: read the current server-authoritative InfoSuite session projection.
- `studentRuntime?action=resume`: renew runtime tokens using the resume token.
- `studentRuntime?action=save`: persist the original fork's `Sim.serializeCharacter(playerId)` snapshot and the chosen class.
- `studentRuntime?action=telemetry`: send small batches of observable runtime facts.
- `studentRuntime?action=quest|evidence|experience`: invoke the existing educational mission/evidence APIs.

The client calls `https://base44.app/api/apps/6ad396b268bd2a7e4b23bd8b/functions` by default. A deployment can override this with `VITE_INFOSUITE_FUNCTIONS_URL`.

## Security rules

- Never trust student, school, class, assignment, or session IDs supplied independently by the browser; the signed ticket and server-side runtime token establish the identity.
- Never put the shared HMAC secret in this client. Only the single-use ticket may appear briefly in the launch URL; remove it from browser history after consumption.
- Keep runtime tokens in `sessionStorage`, never `localStorage`.
- Do not call `studentRuntime?action=finish` when a student closes the game. The InfoSuite teacher/class lifecycle owns finalization.
- The Base44 service must allow CORS only from the configured game origin. CORS is not authentication; every function still verifies its ticket/token.

## Gameplay boundary

The original fork remains the source of truth for the RPG simulation, renderer, HUD, classes, abilities, quests, zones, dungeons, inventory, talents, and localization. This bridge is infrastructure only and must not replace those systems with a parallel implementation.
