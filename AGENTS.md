# AGENTS.md

Context for AI coding agents working in this Shopify theme (Concept by RoarTheme).

Currently documents one feature: **native HubSpot team forms**. If you work on unrelated
parts of the theme, this file's conventions section still applies.

---

## Feature: Native HubSpot team forms

### What and why

Two HubSpot marketing forms were embedded via HubSpot's own embed script, so their UI was
styled by HubSpot (Arial, `#33475b` labels, `#ff7a59` button) and matched nothing else in
the theme. They were rebuilt as native Liquid sections using the theme's own input CSS.

**Only the UI changed.** Submissions POST to HubSpot's Forms API against the *same form
GUID*, so HubSpot records them as submissions of that form and runs that form's own
automation — contact/company upsert, workflows, notification emails, lifecycle stage,
list membership, source attribution. Nothing is bypassed; these are not "non-HubSpot forms".

| Form | GUID | Portal | Region |
|---|---|---|---|
| Team Custom Sales Form | `d7bcd3f3-9615-4cde-a94c-0ca255d083ff` | `46588550` | `na1` |
| Team Discount Form | `7d807dfc-0b9f-4c9c-b2c2-b922f297063c` | `46588550` | `na1` |

Live pages: `/pages/team-sales-program`, `/pages/team-registration`,
`/pages/team-works-alejandro` (Sales); `/pages/team-discount-program` (Discount).

### Files

| File | Role |
|---|---|
| `sections/hubspot-team-sales-form.liquid` | Sales form. Schema name **"Team Sales Form"**, category Forms. |
| `sections/hubspot-team-discount-form.liquid` | Discount form. Schema name **"Team Discount Form"**. |
| `snippets/hubspot-form-field.liquid` | Renders one field. **Shared by both sections** — 23 of the fields are identical, so edit here, not per-section. |
| `snippets/hubspot-form-step.liquid` | Step wrapper: heading, rich text, image, progress bar, Prev/Next/Submit. |
| `assets/hubspot-form.js` | `<hubspot-form>` custom element: step controller, branching, validation, submission. |
| `assets/hubspot-form.css` | Layout only. Inputs/buttons/alerts reuse `theme.css`. |
| `layout/theme.liquid` (~line 55) | Registers both assets, deferred. |

### Status

Built and validated, **not yet placed in any template**. The original HubSpot embeds are
still live and untouched in the `custom_liquid_ijgnyq` section of each page template.
Swapping them out is a manual step after the verification below.

---

## Non-obvious things that will bite you

These are all real bugs that were hit and fixed. Do not "simplify" them back.

1. **`window.BaseElement` is `undefined`.** `assets/theme.js:1093` declares
   `class BaseElement` — a global *binding*, but class declarations do not become window
   properties (unlike `var`). Reference it directly:
   `typeof BaseElement !== 'undefined' ? BaseElement : HTMLElement`.

2. **`display: grid` beats `[hidden]`.** `theme.css:1168` has `[hidden]{display:none}`.
   Any rule setting `display` on the same element at equal specificity wins, leaving all
   steps visible at once. `.hs-form__step[hidden]{display:none}` is restated in
   `hubspot-form.css` for exactly this reason.

3. **Floating labels need the label AFTER the control.** `theme.css:4176` uses a
   following-sibling selector (`:is(.input,.textarea):not(:placeholder-shown) ~ .label`).
   Moving the label before its input silently kills the float. The mobile
   "stack label above" behaviour therefore uses CSS `order: -1`, not DOM reordering.

4. **Text inputs need a non-empty `placeholder`** (or `placeholder=" "`), or
   `:not(:placeholder-shown)` never fires and the label never floats.

5. **Non-required selects don't float.** The trigger is `.select[required]:valid ~ .label` (`theme.css:4173`).
   `contact-form.liquid:142` works around this with `is="custom-select"`; this feature does
   the same.

6. **Dates are midnight-UTC epoch milliseconds.** HubSpot rejects/misreads `YYYY-MM-DD`.
   `serializeValue()` does `String(Date.UTC(y, m-1, d))`. Getting this wrong is *silent*
   data corruption (dates land in 1970 or off by a day).

7. **Dropdowns must send the option `value`, never the label.** They differ:
   `ts_num_of_teams` displays "1-5" but stores `1`; `ts_dm_known` displays
   "I can find out" but stores `Not Sure`. Hence the `value|label` option syntax.

8. **Options are newline-delimited, not comma-split.** HubSpot values contain commas
   ("Single Invoice (Bulk Shipping)"). The theme's `contact-form.liquid` comma-split
   pattern would corrupt them.

9. **`theme.css` has no `.invalid` rule.** Validation styling lives in
   `hubspot-form.css`. This is what tells the visitor *which* field is wrong, because the
   alert is a single summary line (theme convention — see `sections/contact-form.liquid`).

10. **Liquid comments inside `{% liquid %}` use `#`,** not `{% comment %}`. A comment tag
    in there is a `LiquidHTMLSyntaxError`.

11. **`page.team-sales-program.json` is JSONC** (leading `/* */` block). Hand-edit it;
    do not parse-and-rewrite or the header is stripped.

12. **Shopify rejects `"default": ""`** on text settings — omit the key entirely.
    Schema names are capped at **25 characters**.

13. **Presets only apply on fresh insert.** After changing a section's preset blocks, an
    already-placed section keeps its old blocks. The section must be deleted and re-added
    to pick up changes.

---

## Architecture

### Data flow

Field identity lives in the markup as data attributes; the JS never derives anything from
labels:

```
data-hs-field                 marks a submittable control
data-hs-name="firstname"      HubSpot internal property name
data-hs-object="0-1"          objectTypeId: 0-1 contact, 0-2 company
data-hs-type="email"          text | email | tel | date | dropdown | hidden
```

Both forms write to **two HubSpot objects**: contact (`0-1`) and company (`0-2`).
HubSpot creates and associates the company from the `0-2` fields.

### Submission

```
POST https://api.hsforms.com/submissions/v3/integration/submit/{portalId}/{formGuid}
{
  submittedAt: <ms epoch>,
  fields: [{ objectTypeId, name, value }],
  context: { pageUri, pageName, hutk? },
  legalConsentOptions?: { legitimateInterest: {...} }
}
```

- Unauthenticated endpoint, browser-callable, **no token**. The `/secure/submit` variant
  needs a `forms`-scope token which **must never** live in theme code (it is public) —
  that would require a server proxy.
- `200` → follow `redirectUri`, else render `inlineMessage`, else the theme's
  `success_message`.
- `hutk` (the `hubspotutk` cookie) is what stitches the submission to the visitor's
  page-view history. **Omit the key entirely if absent** — never send `hutk: ""`, which
  returns `INVALID_HUTK`. On `INVALID_HUTK` the JS retries once without it.
- Fields on steps the visitor was branched *past* are omitted, matching the embed (which
  only sends `renderedFieldsIds`).

### hutk timing

`layout/theme.liquid:736` injects the HubSpot tracker only on idle-after-`load`, so a fast
submitter has no cookie yet and loses attribution. Two mitigations:
`loadTracker()` injects it eagerly (idempotent — same `hs-script-loader` id guard as
theme.liquid, which is why that block was left alone), plus `waitForHutk()` polls up to
1500ms before submitting. **Never fabricate a hutk.**

### Consent — the two forms differ

- **Sales:** `type: "none"` → omit `legalConsentOptions` entirely.
- **Discount:** `legitimate_interest`, `lawfulBasis: "lead"`. Uses the
  `legitimateInterest` shape, **not** `consent`. HubSpot lists three
  `subscriptionTypeIds` (`370138111`, `370138110`, `610688010`) but the API takes one;
  `370138111` is sent. **Unverified — confirm against an embed submission.**
  The `text` must match HubSpot's configured privacy text byte-for-byte (it is stored as
  the legal basis).

### Step engine

4 steps per form. `visitedStack[]` drives Back, so it never lands on a skipped step
(`onPrev` pops the stack rather than doing `current - 1`).

`syncNavigation()` is the **single owner** of Next/Submit visibility. `applyGate()` must
not touch those buttons — doing so previously caused both to render at once.

**Branch rules** are a section setting (editable, one rule per line):

```
<field> in "value a","value b" => goto <step>
<field> in "v" and <other> in "w" => goto <step>
```

| Form | Rule |
|---|---|
| Sales | persona ∈ {decision maker, influencer} → step 3 |
| Sales | `ts_logo_authorization` ∈ {Refer, Not Sure, No} → show `logo_referral` (field-level) |
| Sales | persona = parent/player → hide `ts_desired_delivery_date`, `ts_lead_ordering_method` (field-level) |
| Discount | persona ∈ {DM, influencer} **and** `ts_custom_interest` = Yes → step 3 |
| Discount | persona ∈ {DM, influencer} **and** `ts_custom_interest` = No → step 4 |
| Discount | persona = parent/player → step 4 |

`ts_custom_interest = "Maybe"` is **not** in HubSpot's rules; it falls through to step 2 in
order. Confirm with the form owner if that is wrong.

### First-step gate

`gate_field` (default `email`) shows only that field on step 1; the rest of step 1 plus
Next and the progress bar appear as soon as a valid-looking email is typed. Implemented by
toggling `.is-gated` on the step and `.hs-field--gate` on the wrapper; CSS `order: -1`
pulls the field to the front while locked, and it returns to its authored slot on unlock.

**Do not duplicate the email input to reposition it** — two inputs sharing an `hs_name`
would both be collected and could send the wrong value.

### Layout

- 2-column grid, `repeat(2, minmax(0, 1fr))`, single column below 750px.
- Per-field `span` setting: `1` = half, `2` = full width.
- **Full width is earned, not declared.** `span: 2` fields get `.hs-field--autofit` and
  sit at **one** column while their label still fits; `watchLabelFit()` /
  `measureLabelFit()` in `hubspot-form.js` measure the pinned label
  (`label.scrollWidth > label.clientWidth`) and add `.hs-field--overflows` to give the
  field both columns back. Notes:
  - The JS adds `.hs-field--fits-1`, which is what makes the CSS honour one column at
    all — so with JS off the fields keep their authored full width (no clipping).
  - Measurement removes `--overflows` from **all** candidates first; otherwise a field
    that is currently wide always reports "fits" and can never shrink back.
  - `.hs-field--autofit > .hs-field__label.is-floating` is `white-space: nowrap` inside
    the desktop media query. Without it the label wraps instead of overflowing and
    nothing ever expands.
  - Re-measured on `ResizeObserver` (deferred to `requestAnimationFrame` — reading
    layout in the callback loops), on `document.fonts.ready`, and after
    `renderStep()`/`refresh()` since the gate reveals fields.
  - `span_fixed` (per-field checkbox) opts out and pins two columns. `file` fields are
    excluded automatically.
- `label_outside` is a **mobile-only** hint. Floating markup is emitted at every width;
  a single `@media (max-width: 749px)` block unpins those labels and stacks them. Desktop
  is untouched. Threshold used: labels ≥ 45 chars (the reference case,
  "What best describes your role in team purchasing?", is 49).

---

## Field inventory

Sales: **27 fields**, 4 steps (13/7/3/4). Discount: **26 fields**, 4 steps (13/7/4/2).
23 fields are shared. Source of truth is HubSpot's Forms API — see "Re-reading the
definitions" below.

Sales-only: `ts_num_of_teams`, `ts_logo_authorization`, `logo_referral`, `ts_logo_upload`.
Discount-only: `ts_custom_interest`, `ts_team_discount_start`,
`ts_discount_distribution_method`.

Hidden (prefilled, no UI): `ts_intake_source`, `ts_lead_source`, `ts_is_decision_maker`.

### Known gap: file upload

`ts_logo_upload` is `fieldType: file` (Sales only, optional). **HubSpot's JSON submission
API cannot accept files.** The input renders *disabled* rather than silently dropping the
visitor's file; `logo_referral` (approver email) is the working fallback. Discount has no
file field. Proper fix would be a serverless proxy to HubSpot's Files API — the token
cannot live in theme code.

---

## Re-reading the form definitions

The MCP HubSpot connector is **CRM-only** — no Forms API — and HubSpot's public
form-definition endpoints now 404. To re-read a definition you need a private-app token
with the **`forms`** scope:

```bash
TOKEN='pat-na1-…'   # never commit; revoke after use
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.hubapi.com/marketing/forms/2026-09-beta/<formId>"
```

Returns field names, `objectTypeId`, types, required/hidden flags, option values *and*
labels, validation, consent config, `recaptchaEnabled`, `postSubmitAction`.

**It does NOT return conditional logic or step boundaries.** Multi-step forms come back as
one flat `default_group` with no step metadata. The Logic tab rules and step membership
must be read from the HubSpot UI by a human. Field *order* in the response matches step
order, which is a useful cross-check.

MCP `get_properties` can supply enum option values, but **not** the form's display labels —
the forms override several, so do not use property data for what the visitor sees.

Do not commit `form-*.json` dumps or `.har` captures (a HAR contains real submission data).

---

## Verification before going live

Nothing is placed yet, so this has **not** been done. Do not remove the embeds first.

1. **Reference capture.** From incognito, submit one *embed* entry per form with a tagged
   address (`qa+embed-sales-01@…`). Save the contact record, the associated **company**
   record, timeline, lists, lifecycle stage, subscription state, notification email.
2. **Branch coverage** on an unpublished theme. Every branch: Sales DM → skips step 2;
   parent/player → step 4 with delivery/ordering hidden; each `ts_logo_authorization`
   value; Discount DM+Yes → 3, DM+No → 4, parent → 4, plus `Maybe`. Every dropdown option
   at least once. Back-navigation through a skipped branch.
3. **Parity diff** for a matched embed/native pair. Highest-risk items:
   both **date** fields landing on the right day; dropdowns storing values not labels; the
   **company** record and its `0-2` properties; **Original/Latest source** and the
   pre-submission page-view timeline (hutk proof); workflow enrollment; Discount's
   **subscription state**; the notification email reaching both recipients
   (`84793983`, `68320423`).
4. **Resilience.** Block `api.hsforms.com` → clean error, values retained. Honeypot filled
   → no submission. Submit <2s → bot floor. Keyboard-only pass through all 4 steps.
5. **Swap.** Only then: place the sections and remove `custom_liquid_ijgnyq` from the page
   templates you are converting. Colors to reproduce from the embed sections —
   Sales/works-alejandro `#ffffff` on `#171717`, padding 28/72; Discount `#ffffff` on
   `#000000`, padding 52/52; registration inherits text, `#171717`, padding 28/72.

Also confirm PostHog (`layout/theme.liquid:675`) is not double-counting once
`hubspot-form:success` exists.

`recaptchaEnabled: false` on both forms, so there is **no captcha parity to preserve**.
A honeypot (`data-honeypot`, never sent to HubSpot) and a 2-second submit floor were added
because the endpoint is public regardless.

---

## Theme conventions

- **Vanilla web components**, no framework. ~110 custom elements in `assets/theme.js`.
  `BaseElement` (`:1093`) gives `this.on()` with AbortController teardown and
  `registerCleanup()` — use it, because the theme editor re-renders sections on every
  setting change.
- `theme.utils.fetchConfig(type, method)` (`assets/theme.js:198`) for fetch headers.
- Form markup reference: `sections/contact-form.liquid:18-190`. Classes: `.field`,
  `.input`, `.select`, `.textarea`, `.label`, `is-floating` (`theme.css:4053-4260`).
- Buttons: `.button.button--primary.button--fixed` with `is="hover-button"` and inner
  `<span class="btn-fill" data-fill></span><span class="btn-text">`. **Do not restructure
  those children** — `hover-button` reads them. Toggle `disabled`/`aria-busy` and swap
  `.btn-text` only.
- Alerts: `{% render 'alert', status: 'error'|'success', content: … %}`.
- Errors: mark bad fields inline, show **one** short summary — never an enumerated list.
- Spacing/color tokens from `snippets/css-variables.liquid`: `--sp-*`, `--color-foreground`,
  `--color-background`, `--color-error-text` (RGB triplets, used as
  `rgb(var(--token))`), `--card-radius`, `--inputs-radius`, `--buttons-radius`,
  `--animation-smooth`, `--text-sm`. There is **no** `--blocks-radius`.
- `assets/custom.css` exists but is **not loaded** by the layout.

### Validate before handing back

```bash
shopify theme check 2>&1 | grep -c hubspot   # expect 0
node --check assets/hubspot-form.js
```

The theme has ~211 pre-existing offenses elsewhere; only regressions in these files matter.
Also assert schema JSON parses, no blank defaults, and field counts are still 27 / 26 —
a preset-editing script once silently dropped steps 2-4 (recovered from commit `b8f5e37`).

### User preferences

Extremely concise replies, no end-of-response summaries. Don't mention Claude in commit
messages. Don't ask for build/test commands — the user runs those.
