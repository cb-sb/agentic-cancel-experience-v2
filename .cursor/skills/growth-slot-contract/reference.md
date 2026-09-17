# Slot contract reference (v1.0.0)

Agency / personal-LLM wrapper around the same schema Chargebee Copilot already
validates. Copilot remains the compiler.

## Restyle example

Keep the marks. Change classes and copy.

```html
<section class="page" data-cb-step="confirm" data-cb-kind="confirmation">
  <h1>Leave this plan?</h1>
  <button type="button" data-cb-action="keep">Stay</button>
  <button type="button" data-cb-action="cancel">Yes, cancel</button>
</section>
```

## Rejection example

This fails `validateContract` — no `data-cb-kind`, no keep/cancel:

```html
<section>
  <h1>Cancel</h1>
  <a href="/done">Confirm</a>
</section>
```

## Slot honesty

Regions with `class="slot"` are Growth-owned at confirm. Bracketed copy (`[offer title]`, `[reason]`) is dummy. Do not invent catalog offers or survey reasons in those nodes.

```html
<div class="offer slot" data-cb-slot="offer">
  <p class="slot-label">Growth slot — offer catalog</p>
  <h1 data-cb-bind="title">[offer title]</h1>
</div>
```

## What Growth does after upload

1. Scan `data-cb-*` (fail closed).
2. Copilot narrates the review in chat.
3. Merchant binds offer catalog / survey reasons.
4. Pack is saved as a journey in **My templates**; each marked step is upserted as a reusable library component.
5. Copilot fills brand, audience, holdout, and walk. Those never come from this file.

Do not upload the Growth kit catalog zip. Compose an experience first.
