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

## What Growth does after upload

1. Scan `data-cb-*` (fail closed).
2. Copilot narrates the review in chat.
3. Merchant binds offer catalog / survey reasons.
4. Pack is saved to **My templates** (Yours) and each marked step becomes a reusable component.
5. Copilot fills brand, audience, holdout, and walk. Those never come from this file.
