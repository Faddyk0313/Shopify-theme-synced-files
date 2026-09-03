/**
 * <hubspot-form>
 *
 * Native multi-step form that submits to HubSpot's Forms API against the same form
 * GUID as the original embed, so HubSpot runs that form's own automation
 * (contact/company upsert, workflows, notification emails, lifecycle, lists).
 *
 * Field identity lives entirely in the markup as data attributes:
 *   data-hs-name    HubSpot internal property name
 *   data-hs-object  objectTypeId ("0-1" contact, "0-2" company)
 *   data-hs-type    text | email | tel | date | dropdown | hidden
 */
(() => {
  const SUBMIT_ENDPOINT = 'https://api.hsforms.com/submissions/v3/integration/submit';
  const HUTK_WAIT_MS = 1500;
  const HUTK_POLL_MS = 100;
  const MIN_ELAPSED_MS = 2000;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // `class BaseElement` in theme.js is a global binding but is NOT a window property,
  // so it must be referenced directly rather than via window.
  const Base = typeof BaseElement !== 'undefined' ? BaseElement : HTMLElement;

  class HubSpotForm extends Base {
    connectedCallback() {
      super.connectedCallback?.();

      this.form = this.querySelector('form');
      if (!this.form) return;

      this.steps = Array.from(this.querySelectorAll('[data-step]'));
      this.successSlot = this.querySelector('[data-success]');
      this.honeypot = this.querySelector('[data-honeypot]');
      this.mountedAt = Date.now();

      this.rules = this.parseRules(this.dataset.branchRules);
      this.visited = [];
      this.current = 1;
      this.gateField = this.dataset.gateField || '';
      this.gateUnlocked = !this.gateField;

      this.loadTracker();

      this.on(this.form, 'submit', (event) => this.onSubmit(event));
      this.on(this, 'click', (event) => {
        if (event.target.closest('[data-next]')) this.onNext();
        if (event.target.closest('[data-prev]')) this.onPrev();
      });
      // Re-evaluate conditional fields as the visitor fills the form.
      this.on(this, 'change', () => this.refresh());
      this.on(this, 'input', () => this.refresh());

      this.renderStep(1, { focus: false });
      this.syncNavigation();
      this.watchLabelFit();
    }

    disconnectedCallback() {
      super.disconnectedCallback?.();
      this.fitObserver?.disconnect();
      this.fitObserver = null;
    }

    /* ------------------------------------------------------------------ setup */

    /**
     * The theme loads the HubSpot tracker only on idle-after-load, which can leave a
     * fast submitter without a `hubspotutk` cookie and lose page-view attribution.
     * Injecting it here is idempotent -- theme.liquid guards on the same element id.
     */
    loadTracker() {
      const portalId = this.dataset.portalId;
      if (!portalId || document.getElementById('hs-script-loader')) return;

      const script = document.createElement('script');
      script.id = 'hs-script-loader';
      script.async = true;
      script.defer = true;
      script.src = `//js.hs-scripts.com/${portalId}.js`;
      document.head.appendChild(script);
    }

    /**
     * Branch rules use one line per rule:
     *   <fieldName> in "value a","value b" => goto <step>
     *   <fieldName> in "value" and <otherField> in "value" => goto <step>
     */
    parseRules(raw) {
      if (!raw) return [];

      return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [conditionPart, targetPart] = line.split('=>');
          if (!conditionPart || !targetPart) return null;

          const target = parseInt(targetPart.replace(/[^0-9]/g, ''), 10);
          if (!target) return null;

          const conditions = conditionPart
            .split(/\band\b/)
            .map((chunk) => {
              const match = chunk.trim().match(/^(\S+)\s+in\s+(.+)$/i);
              if (!match) return null;

              const values = (match[2].match(/"([^"]*)"/g) || []).map((value) =>
                value.slice(1, -1)
              );
              if (!values.length) return null;

              return { field: match[1], values };
            })
            .filter(Boolean);

          return conditions.length ? { conditions, target } : null;
        })
        .filter(Boolean);
    }

    /* ------------------------------------------------------------- step engine */

    stepEl(index) {
      return this.steps.find((step) => Number(step.dataset.step) === index);
    }

    renderStep(index, { focus = true } = {}) {
      const target = this.stepEl(index);
      if (!target) return;

      this.current = index;
      this.steps.forEach((step) => {
        step.hidden = step !== target;
      });

      const prev = target.querySelector('[data-prev]');
      if (prev) prev.hidden = this.visited.length === 0;

      this.updateProgress(target, index);
      this.applyFieldRules();
      this.applyGate();
      this.syncNavigation();
      this.clearAlert(target);
      this.measureLabelFit();

      if (focus) {
        const heading = target.querySelector('[data-step-heading]');
        (heading || target).focus?.({ preventScroll: true });
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    updateProgress(stepEl, index) {
      const total = this.steps.length;
      const count = stepEl.querySelector('[data-progress-count]');
      const fill = stepEl.querySelector('[data-progress-fill]');

      if (count) count.textContent = `${index}/${total}`;
      if (fill) fill.style.width = `${(index / total) * 100}%`;
    }

    /**
     * Progressive disclosure for the first step: until the gate field (the email) has
     * a plausible value, the rest of step 1 stays hidden so the form opens as a single
     * question. Gated wrappers are marked so validation and the payload skip them.
     */
    applyGate() {
      if (!this.gateField) return;

      if (this.current !== 1) return;

      const gate = this.querySelector(`[data-hs-name="${this.gateField}"]`);
      if (!gate) return;

      const value = (gate.value || '').trim();
      const unlocked = EMAIL_RE.test(value);
      const gateWrapper = gate.closest('[data-field-wrapper]');

      // The gate field is visually pulled to the front only while the step is locked;
      // once unlocked it returns to its authored position in the grid. Handled with
      // CSS `order` so there is exactly one input for this HubSpot property.
      gateWrapper?.classList.add('hs-field--gate');
      this.stepEl(1)?.classList.toggle('is-gated', !unlocked);

      this.querySelectorAll('[data-step="1"] [data-field-wrapper]').forEach((wrapper) => {
        if (wrapper === gateWrapper) return;

        const wasHidden = wrapper.hidden;
        wrapper.hidden = !unlocked;
        // Tag only the transition so the reveal animation runs once, not per keystroke.
        if (wasHidden && !wrapper.hidden) {
          wrapper.classList.add('is-revealed');
          wrapper.addEventListener(
            'animationend',
            () => wrapper.classList.remove('is-revealed'),
            { once: true }
          );
        }
      });

      const stepEl = this.stepEl(1);
      if (!stepEl) return;

      // Nothing to advance to until the visitor has given us an email. Only the button
      // syncNavigation chose for this step is revealed -- never both.
      this.gateUnlocked = unlocked;
      stepEl.querySelector('[data-progress]')?.toggleAttribute('hidden', !unlocked);
    }

    /** Fields on a hidden conditional wrapper are excluded from validation and payload. */
    applyFieldRules() {
      this.querySelectorAll('[data-show-when-field]').forEach((wrapper) => {
        const name = wrapper.dataset.showWhenField;
        const allowed = (wrapper.dataset.showWhenValues || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

        const source = this.querySelector(`[data-hs-name="${name}"]`);
        const value = source ? source.value : '';
        wrapper.hidden = !allowed.includes(value);
      });
    }

    /** Returns the next step, honouring branch rules; null when there is none. */
    nextStep() {
      const values = this.currentValues();

      for (const rule of this.rules) {
        const matches = rule.conditions.every((condition) =>
          condition.values.includes(values[condition.field])
        );
        if (matches && rule.target > this.current) return rule.target;
      }

      const later = this.steps
        .map((step) => Number(step.dataset.step))
        .filter((index) => index > this.current)
        .sort((a, b) => a - b);

      return later.length ? later[0] : null;
    }

    currentValues() {
      const values = {};
      this.querySelectorAll('[data-hs-field]').forEach((field) => {
        values[field.dataset.hsName] = field.value;
      });
      return values;
    }

    onNext() {
      if (!this.validateStep(this.current)) return;

      const target = this.nextStep();
      if (!target) return;

      this.visited.push(this.current);
      this.renderStep(target);
      this.syncNavigation();
    }

    onPrev() {
      const previous = this.visited.pop();
      if (!previous) return;
      this.renderStep(previous);
      this.syncNavigation();
    }

    /**
     * Whether the visitor can go further depends on the branch they are on, so the
     * Next/Submit swap is decided per step rather than baked in at render time.
     */
    syncNavigation() {
      const stepEl = this.stepEl(this.current);
      if (!stepEl) return;

      const hasNext = this.nextStep() !== null;
      const next = stepEl.querySelector('[data-next]');
      const submit = stepEl.querySelector('[data-submit]');

      // On the gated first step, hide both until the gate opens.
      const locked = this.current === 1 && this.gateField && !this.gateUnlocked;

      if (next) next.hidden = locked || !hasNext;
      if (submit) submit.hidden = locked || hasNext;
    }

    /** Re-evaluates conditional fields, the first-step gate and the nav in one pass. */
    refresh() {
      this.applyFieldRules();
      this.applyGate();
      this.syncNavigation();
      this.measureLabelFit();
    }

    /* ----------------------------------------------------------- label fitting */

    /**
     * Half-width is the default even for the long question labels. A label only earns
     * the full two columns when it actually stops fitting, which depends on the
     * rendered width -- so it is measured rather than hard-coded. `.hs-field--fits-1`
     * (set on every candidate up front) is what makes the CSS honour span 1 at all;
     * `.hs-field--overflows` puts the field back to full width.
     *
     * Measuring means temporarily assuming the narrow layout, otherwise a field that
     * is currently full width always reports "fits" and never shrinks back.
     */
    watchLabelFit() {
      this.fitCandidates = Array.from(
        this.querySelectorAll('.hs-field--autofit')
      ).filter((wrapper) => wrapper.querySelector('.hs-field__label'));

      if (!this.fitCandidates.length) return;

      this.fitCandidates.forEach((wrapper) => wrapper.classList.add('hs-field--fits-1'));

      const measure = () => this.measureLabelFit();

      if ('ResizeObserver' in window) {
        this.fitObserver = new ResizeObserver(() => {
          // Reading layout inside the callback would loop; defer to the next frame.
          cancelAnimationFrame(this.fitFrame);
          this.fitFrame = requestAnimationFrame(measure);
        });
        this.fitCandidates.forEach((wrapper) => this.fitObserver.observe(wrapper));
        this.registerCleanup?.(() => this.fitObserver?.disconnect());
      } else {
        this.on(window, 'resize', measure);
      }

      measure();
      // Web fonts land after first paint and change the measurement.
      document.fonts?.ready.then(measure).catch(() => {});
    }

    measureLabelFit() {
      if (!this.fitCandidates?.length) return;

      // Assume the narrow layout for all candidates first, so each is measured at the
      // width it would have if it stayed at one column.
      this.fitCandidates.forEach((wrapper) => wrapper.classList.remove('hs-field--overflows'));

      const overflowing = this.fitCandidates.filter((wrapper) => {
        if (wrapper.hidden || !wrapper.offsetParent) return false;

        const label = wrapper.querySelector('.hs-field__label');

        // theme.css scales a floated label to 0.70, so `scrollWidth` would report a
        // filled field as fitting and the field would shrink mid-interaction. Measure
        // the text at its unscaled size instead, so the decision does not depend on
        // whether the visitor has typed anything yet.
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect().width;
        range.detach?.();

        // The measured rect is already scaled by the float transform; divide it back
        // out so the same threshold applies empty or filled.
        const matrix = new DOMMatrixReadOnly(getComputedStyle(label).transform);
        const unscaled = matrix.a > 0 ? text / matrix.a : text;

        return unscaled > label.clientWidth + 1;
      });

      overflowing.forEach((wrapper) => wrapper.classList.add('hs-field--overflows'));
    }

    /* ------------------------------------------------------------- validation */

    visibleFields(stepEl) {
      return Array.from(stepEl.querySelectorAll('[data-hs-field]')).filter((field) => {
        if (field.type === 'hidden') return true;
        const wrapper = field.closest('[data-field-wrapper]');
        return !(wrapper && wrapper.hidden);
      });
    }

    validateStep(index) {
      const stepEl = this.stepEl(index);
      if (!stepEl) return true;

      const errors = [];
      let firstInvalid = null;

      this.visibleFields(stepEl).forEach((field) => {
        const wrapper = field.closest('[data-field-wrapper]');
        const label = this.labelFor(field, wrapper);
        const value = (field.value || '').trim();

        wrapper?.classList.remove('has-error');
        field.classList.remove('invalid');

        const fail = (message) => {
          errors.push(message);
          wrapper?.classList.add('has-error');
          field.classList.add('invalid');
          if (!firstInvalid) firstInvalid = field;
        };

        if (field.required && !value) {
          fail(`${label} is required.`);
          return;
        }


        if (!value) return;

        if (field.dataset.hsType === 'email' && !EMAIL_RE.test(value)) {
          fail(`${label} must be a valid email address.`);
          return;
        }

        if (field.dataset.hsType === 'tel') {
          const digits = value.replace(/\D/g, '').length;
          const min = parseInt(field.dataset.minDigits || '0', 10);
          const max = parseInt(field.dataset.maxDigits || '0', 10);
          if (min && digits < min) fail(`${label} must have at least ${min} digits.`);
          else if (max && digits > max) fail(`${label} must have at most ${max} digits.`);
        }
      });

      if (errors.length) {
        // The theme flags bad fields inline with `.invalid` and shows a single short
        // summary (see sections/contact-form.liquid), so specifics stay on the fields.
        const summary =
          errors.length === 1
            ? errors[0]
            : this.dataset.requiredMessage || 'Please complete the highlighted fields.';
        this.showAlert(stepEl, summary);
        firstInvalid?.focus();
        return false;
      }

      this.clearAlert(stepEl);
      return true;
    }

    labelFor(field, wrapper) {
      const label = wrapper?.querySelector('.hs-field__label');
      const text = label?.textContent?.replace(/\*\s*$/, '').trim();
      return text || field.dataset.hsName || 'This field';
    }

    showAlert(stepEl, message) {
      const slot = stepEl.querySelector('[data-alert]');
      if (!slot) return;

      slot.innerHTML =
        '<div class="alert alert--error flex items-start gap-3 text-sm md:text-base leading-tight">' +
        `<span>${message}</span></div>`;
      slot.hidden = false;
    }

    clearAlert(stepEl) {
      const slot = stepEl?.querySelector('[data-alert]');
      if (!slot) return;
      slot.innerHTML = '';
      slot.hidden = true;
    }

    /* ------------------------------------------------------------- submission */

    getHutk() {
      const match = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]*)/);
      return match ? decodeURIComponent(match[1]) : null;
    }

    /** Waits briefly for the tracker to set the cookie so attribution is preserved. */
    async waitForHutk() {
      const deadline = Date.now() + HUTK_WAIT_MS;
      let hutk = this.getHutk();

      while (!hutk && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, HUTK_POLL_MS));
        hutk = this.getHutk();
      }

      return hutk;
    }

    /**
     * Collects only fields the visitor actually saw -- steps they were branched past
     * are omitted, matching the embed, which sends only its rendered fields.
     */
    collectFields() {
      const reachable = new Set([...this.visited, this.current]);
      const fields = [];

      this.steps.forEach((stepEl) => {
        if (!reachable.has(Number(stepEl.dataset.step))) return;

        this.visibleFields(stepEl).forEach((field) => {
          const value = this.serializeValue(field);
          if (value === '' || value === null) return;

          fields.push({
            objectTypeId: field.dataset.hsObject || '0-1',
            name: field.dataset.hsName,
            value
          });
        });
      });

      return fields;
    }

    serializeValue(field) {
      const raw = (field.value || '').trim();
      if (!raw) return '';

      // HubSpot stores dates as midnight-UTC epoch milliseconds, not YYYY-MM-DD.
      if (field.dataset.hsType === 'date') {
        const [year, month, day] = raw.split('-').map(Number);
        if (!year || !month || !day) return '';
        return String(Date.UTC(year, month - 1, day));
      }

      return raw;
    }

    buildPayload(hutk) {
      const payload = {
        submittedAt: Date.now(),
        fields: this.collectFields(),
        context: {
          pageUri: window.location.href,
          pageName: this.dataset.pageName || document.title
        }
      };

      if (hutk) payload.context.hutk = hutk;

      if (this.dataset.consentMode === 'legitimate_interest') {
        payload.legalConsentOptions = {
          legitimateInterest: {
            value: true,
            subscriptionTypeId: parseInt(this.dataset.consentSubscriptionId, 10),
            legalBasis: 'LEAD',
            text: this.dataset.consentText || ''
          }
        };
      }

      return payload;
    }

    async onSubmit(event) {
      event.preventDefault();

      if (!this.validateStep(this.current)) return;

      // Bot traps: a filled honeypot or an implausibly fast submit is dropped silently.
      if (this.honeypot?.value || Date.now() - this.mountedAt < MIN_ELAPSED_MS) {
        this.showSuccess(null);
        return;
      }

      this.setLoading(true);

      try {
        const hutk = await this.waitForHutk();
        const result = await this.post(this.buildPayload(hutk));

        if (result.ok) {
          this.onSuccess(result.json);
          return;
        }

        // A stale cookie rejects the whole submission; retrying without it still
        // captures the lead, only losing page-view attribution.
        if (result.status === 400 && this.hasErrorType(result.json, 'INVALID_HUTK')) {
          const retry = await this.post(this.buildPayload(null));
          if (retry.ok) {
            this.onSuccess(retry.json);
            return;
          }
          this.onFailure(retry);
          return;
        }

        this.onFailure(result);
      } catch (error) {
        console.error('[hubspot-form] submission failed', error);
        this.showError(this.dataset.errorMessage);
      } finally {
        this.setLoading(false);
      }
    }

    async post(payload) {
      const url = `${SUBMIT_ENDPOINT}/${this.dataset.portalId}/${this.dataset.formGuid}`;
      const config = window.theme?.utils?.fetchConfig
        ? window.theme.utils.fetchConfig('json')
        : { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } };

      const response = await fetch(url, { ...config, body: JSON.stringify(payload) });
      const json = await response.json().catch(() => null);

      return { ok: response.ok, status: response.status, json };
    }

    hasErrorType(json, type) {
      return Boolean(json?.errors?.some((error) => error.errorType === type));
    }

    onSuccess(json) {
      if (json?.redirectUri) {
        window.location.assign(json.redirectUri);
        return;
      }

      this.showSuccess(json?.inlineMessage);
      this.dispatchEvent(new CustomEvent('hubspot-form:success', { bubbles: true }));
    }

    onFailure(result) {
      const json = result.json;
      const errors = Array.isArray(json?.errors) ? json.errors : [];

      // These two mean the theme's field config disagrees with HubSpot's form
      // definition -- a configuration bug, not something the visitor can fix.
      const configError = errors.find((error) =>
        ['FIELD_NOT_IN_FORM_DEFINITION', 'VALUE_NOT_IN_FIELD_DEFINITION'].includes(
          error.errorType
        )
      );

      if (configError) {
        console.error('[hubspot-form] form configuration mismatch', errors);
        this.showError(this.dataset.errorMessage);
      } else if (this.hasErrorType(json, 'BLOCKED_EMAIL')) {
        this.showError('Please use a different email address.');
      } else if (errors.length) {
        console.error('[hubspot-form] validation rejected', errors);
        this.showError(this.friendlyErrors(errors));
      } else {
        console.error('[hubspot-form] submission failed', result.status, json);
        this.showError(this.dataset.errorMessage);
      }

      this.dispatchEvent(new CustomEvent('hubspot-form:error', { bubbles: true }));
    }

    friendlyErrors(errors) {
      const messages = errors.map((error) => {
        switch (error.errorType) {
          case 'REQUIRED_FIELD':
            return 'Please complete all required fields.';
          case 'INVALID_EMAIL':
            return 'Please enter a valid email address.';
          default:
            return null;
        }
      });

      return [...new Set(messages.filter(Boolean))].join(' ') || this.dataset.errorMessage;
    }

    showSuccess(inlineMessage) {
      if (inlineMessage && this.successSlot) {
        this.successSlot.innerHTML = inlineMessage;
      }

      this.form.hidden = true;
      if (this.successSlot) {
        this.successSlot.hidden = false;
        this.successSlot.setAttribute('role', 'status');
        this.successSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    showError(message) {
      const stepEl = this.stepEl(this.current);
      if (stepEl && message) this.showAlert(stepEl, message);
    }

    setLoading(isLoading) {
      const stepEl = this.stepEl(this.current);
      const button = stepEl?.querySelector('[data-submit]');
      if (!button) return;

      button.disabled = isLoading;
      button.setAttribute('aria-busy', isLoading ? 'true' : 'false');

      const text = button.querySelector('.btn-text');
      if (!text) return;

      if (isLoading) {
        this.submitLabel = text.textContent;
        text.textContent = this.dataset.loadingLabel || 'Submitting…';
      } else if (this.submitLabel) {
        text.textContent = this.submitLabel;
      }
    }
  }

  if (!customElements.get('hubspot-form')) {
    customElements.define('hubspot-form', HubSpotForm);
  }
})();
