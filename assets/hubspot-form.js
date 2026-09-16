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
 *   data-hs-type    text | email | tel | date | dropdown | file | hidden
 */
(() => {
  const SUBMIT_ENDPOINT = 'https://api.hsforms.com/submissions/v3/integration/submit';
  const HUTK_WAIT_MS = 1500;
  const HUTK_POLL_MS = 100;
  const MIN_ELAPSED_MS = 2000;
  // Must match MAX_UPLOAD_BYTES in the relay (api/hubspot-logo-upload). Vercel Hobby
  // caps serverless request bodies at ~4.5MB, so oversized files are rejected here --
  // before the visitor waits on an upload that the platform would refuse anyway.
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
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
      this.on(this, 'change', (event) => {
        if (event.target.dataset?.hsType === 'file') this.checkFileSize(event.target);
        this.refresh();
      });
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
     * Branch rules use one line per rule, mirroring HubSpot's Logic tab, where every
     * rule is scoped to the step it fires *from*:
     *   from <step>: <fieldName> in "value a","value b" => goto <step>
     *   from <step>: <field> in "v" and <otherField> in "w" => goto <step>
     * `from` may be omitted, in which case the rule applies from step 1.
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

          // Optional "from N:" prefix scopes the rule to one step (HubSpot's From step).
          let scope = conditionPart;
          let from = 1;
          const fromMatch = scope.match(/^\s*from\s+(\d+)\s*:/i);
          if (fromMatch) {
            from = parseInt(fromMatch[1], 10);
            scope = scope.slice(fromMatch[0].length);
          }

          const conditions = scope
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

          return conditions.length ? { conditions, target, from } : null;
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

      // The gate only staggers the fields -- progress and navigation stay visible from
      // the start, so the step reads as step 1 of N and Next validates the gate field.
      this.gateUnlocked = unlocked;
      stepEl.querySelector('[data-progress]')?.removeAttribute('hidden');
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
        // A rule fires only from the step it is scoped to, so the same condition can
        // route differently depending on where the visitor is.
        if (rule.from !== this.current) continue;

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
      // Step 1's gate hides the rest of its fields, which validateStep skips. Flag the
      // gate field itself so Next cannot jump past fields the visitor never saw.
      if (this.current === 1 && this.gateField && !this.gateUnlocked) {
        this.validateStep(1);
        const gate = this.querySelector(`[data-hs-name="${this.gateField}"]`);
        gate?.focus();
        return;
      }

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

      if (next) next.hidden = !hasNext;
      if (submit) submit.hidden = hasNext;
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

    /**
     * Flags an oversized file the moment it is chosen. Real submissions include .ai/.eps
     * masters over 5MB, and the relay (Vercel Hobby, ~4.5MB body limit) cannot take them,
     * so telling the visitor at selection time beats failing at submit.
     */
    checkFileSize(field) {
      const wrapper = field.closest('[data-field-wrapper]');
      const file = field.files?.[0];
      const tooBig = Boolean(file && file.size > MAX_UPLOAD_BYTES);

      field.classList.toggle('invalid', tooBig);
      wrapper?.classList.toggle('has-error', tooBig);

      const stepEl = field.closest('[data-step]');
      if (tooBig) {
        const mb = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024));
        const label = this.labelFor(field, wrapper);
        this.showAlert(stepEl, `${label} must be smaller than ${mb}MB.`);
      } else {
        this.clearAlert(stepEl);
      }

      return !tooBig;
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

        // A file input's value is a fake path ("C:\\fakepath\\logo.png"); the real
        // check is on .files, handled below.


        if (!value) return;

        if (field.dataset.hsType === 'email' && !EMAIL_RE.test(value)) {
          fail(`${label} must be a valid email address.`);
          return;
        }

        if (field.dataset.hsType === 'file') {
          const file = field.files?.[0];
          if (file && file.size > MAX_UPLOAD_BYTES) {
            const mb = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024));
            fail(`${label} must be smaller than ${mb}MB.`);
          }
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
          // Files are uploaded separately; uploadedFiles holds the resulting URL.
          if (field.dataset.hsType === 'file') {
            const url = this.uploadedFiles?.get(field.dataset.hsName);
            if (url) {
              fields.push({
                objectTypeId: field.dataset.hsObject || '0-1',
                name: field.dataset.hsName,
                value: url
              });
            }
            return;
          }

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

    /**
     * Uploads every selected file to the relay and remembers the URL it returns, which
     * collectFields() then submits as that field's value. HubSpot's forms API is
     * JSON-only, so the file cannot travel with the submission itself.
     *
     * Returns false when an upload fails, so the submission is abandoned rather than
     * silently recording a contact with the logo missing.
     */
    async uploadFiles() {
      const endpoint = this.dataset.uploadEndpoint;
      this.uploadedFiles = new Map();

      const reachable = new Set([...this.visited, this.current]);
      const pending = [];

      this.steps.forEach((stepEl) => {
        if (!reachable.has(Number(stepEl.dataset.step))) return;

        this.visibleFields(stepEl).forEach((field) => {
          if (field.dataset.hsType !== 'file') return;
          const file = field.files?.[0];
          if (file) pending.push({ field, file });
        });
      });

      if (!pending.length) return true;

      if (!endpoint) {
        console.error('[hubspot-form] a file was selected but no upload endpoint is set');
        this.showError('We could not upload your file. Please try again.');
        return false;
      }

      for (const { field, file } of pending) {
        const body = new FormData();
        body.append('file', file, file.name);

        let json = null;
        try {
          const response = await fetch(endpoint, { method: 'POST', body });
          json = await response.json().catch(() => null);

          if (!response.ok || !json?.url) {
            console.error('[hubspot-form] upload rejected', response.status, json);
            this.showError(json?.message || 'We could not upload your file. Please try again.');
            field.classList.add('invalid');
            field.closest('[data-field-wrapper]')?.classList.add('has-error');
            return false;
          }
        } catch (error) {
          console.error('[hubspot-form] upload failed', error);
          this.showError('We could not upload your file. Please try again.');
          return false;
        }

        this.uploadedFiles.set(field.dataset.hsName, json.url);
      }

      return true;
    }

    /**
     * Groups the collected fields by HubSpot object so the relay can upsert a contact
     * and a company separately. The Forms API took a flat `fields` array with an
     * objectTypeId per entry; the CRM API needs one property bag per object.
     */
    buildPayload(hutk) {
      const contact = {};
      const company = {};

      this.collectFields().forEach(({ objectTypeId, name, value }) => {
        if (objectTypeId === '0-2') company[name] = value;
        else contact[name] = value;
      });

      const payload = {
        formName: this.dataset.formName || this.dataset.pageName || '',
        contact,
        company,
        pageUri: window.location.href,
        pageName: this.dataset.pageName || document.title
      };

      if (hutk) payload.hutk = hutk;

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
        // Files go to File Manager first; the submission carries the returned URLs.
        if (!(await this.uploadFiles())) return;

        const hutk = await this.waitForHutk();
        const result = await this.post(this.buildPayload(hutk));

        if (result.ok) {
          this.onSuccess(result.json);
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
      const url = this.dataset.submitEndpoint;
      if (!url) {
        console.error('[hubspot-form] no submit endpoint configured');
        return { ok: false, status: 0, json: null };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await response.json().catch(() => null);

      // The relay reports failure in the body as well as the status code.
      return { ok: response.ok && json?.success !== false, status: response.status, json };
    }

    onSuccess(json) {
      if (json?.contactId) {
        this.dataset.contactId = json.contactId;
      }

      this.showSuccess(null);
      this.dispatchEvent(
        new CustomEvent('hubspot-form:success', { bubbles: true, detail: json || {} })
      );
    }

    onFailure(result) {
      const message = result.json?.error;
      console.error('[hubspot-form] submission failed', result.status, result.json);

      // The relay returns a readable message for validation problems (400) and a
      // generic one for anything upstream; fall back to the section's own copy.
      this.showError(
        result.status === 400 && message ? message : this.dataset.errorMessage
      );

      this.dispatchEvent(new CustomEvent('hubspot-form:error', { bubbles: true }));
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
