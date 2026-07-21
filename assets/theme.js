/*
@license
  Concept by RoarTheme (https://roartheme.co)
  Access unminified JS in assets/theme.js

  Use this event listener to run your own JS outside of this file.
  Documentation - https://roartheme.co/blogs/concept/javascript-events-for-developers

  document.addEventListener('page:loaded', function() {
    // Page has loaded and theme assets are ready
  });
*/

window.theme = window.theme || {};
window.Shopify = window.Shopify || {};

theme.config = {
  hasSessionStorage: true,
  hasLocalStorage: true,
  mqlSmall: false,
  mediaQuerySmall: 'screen and (max-width: 767px)',
  motionReduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  isTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0),
  rtl: document.documentElement.getAttribute('dir') === 'rtl' ? true : false
};

theme.supportsPassive = false;

try {
  const opts = Object.defineProperty({}, 'passive', {
    get: function () {
      theme.supportsPassive = true;
    }
  });
  window.addEventListener('testPassive', null, opts);
  window.removeEventListener('testPassive', null, opts);
} catch (e) { }

console.log(theme.settings.themeName + ' theme (' + theme.settings.themeVersion + ') by RoarTheme | Learn more at https://roartheme.co');

(function () {
  /*============================================================================
    Things that require DOM to be ready
  ==============================================================================*/
  theme.DOMready = function (callback) {
    if (document.readyState != 'loading') callback();
    else document.addEventListener('DOMContentLoaded', callback);
  }

  theme.headerGroup = {
    rounded: () => {
      return Array.from(document.querySelectorAll('.shopify-section-group-header-group .section--rounded'));
    },
    sections: () => {
      return Array.from(document.querySelectorAll('.shopify-section-group-header-group'));
    },
    init: () => {
      let previousSection = null;
      const rounded = theme.headerGroup.rounded();
      const sections = theme.headerGroup.sections();

      sections.forEach((shopifySection, index) => {
        const section = shopifySection.querySelector('.section');
        if (section) {
          section.classList.remove('section--next-rounded');
          section.classList.remove('section--first-rounded');
          section.classList.remove('section--last-rounded');

          if (section.classList.contains('section--rounded')) {
            if (index === 0) {
              section.classList.add('section--first-rounded');
            }

            if (index === rounded.length - 1) {
              section.classList.add('section--last-rounded');
            }

            if (previousSection && previousSection.classList.contains('section--rounded')) {
              previousSection.classList.add('section--next-rounded');
            }
          }

          if (index === sections.length - 1) {
            const nextSection = document.querySelector('.main-content .shopify-section:first-child .section');
            if (nextSection && nextSection.classList.contains('section--rounded')) {
              section.classList.add('section--next-rounded');
            }
          }

          previousSection = section;
        }
      });
    }
  };

  theme.a11y = {
    trapFocusHandlers: {},

    getFocusableElements: (container) => {
      return Array.from(
        container.querySelectorAll(
          'summary, a[href], button:enabled, [tabindex]:not([tabindex^="-"]), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe'
        )
      );
    },

    trapFocus: (container, elementToFocus = container) => {
      const elements = theme.a11y.getFocusableElements(container);
      const first = elements[0];
      const last = elements[elements.length - 1];

      theme.a11y.removeTrapFocus();

      theme.a11y.trapFocusHandlers.focusin = (event) => {
        if (event.target !== container && event.target !== last && event.target !== first) return;

        document.addEventListener('keydown', theme.a11y.trapFocusHandlers.keydown);
      };

      theme.a11y.trapFocusHandlers.focusout = function () {
        document.removeEventListener('keydown', theme.a11y.trapFocusHandlers.keydown);
      };

      theme.a11y.trapFocusHandlers.keydown = function (event) {
        if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
        // On the last focusable element and tab forward, focus the first element.
        if (event.target === last && !event.shiftKey) {
          event.preventDefault();
          first.focus();
        }

        //  On the first focusable element and tab backward, focus the last element.
        if ((event.target === container || event.target === first) && event.shiftKey) {
          event.preventDefault();
          last.focus();
        }
      };

      document.addEventListener('focusout', theme.a11y.trapFocusHandlers.focusout);
      document.addEventListener('focusin', theme.a11y.trapFocusHandlers.focusin);

      elementToFocus.focus();

      if (elementToFocus.tagName === 'INPUT' && ['search', 'text', 'email', 'url'].includes(elementToFocus.type) && elementToFocus.value) {
        elementToFocus.setSelectionRange(0, elementToFocus.value.length);
      }
    },

    removeTrapFocus: (elementToFocus = null) => {
      document.removeEventListener('focusin', theme.a11y.trapFocusHandlers.focusin);
      document.removeEventListener('focusout', theme.a11y.trapFocusHandlers.focusout);
      document.removeEventListener('keydown', theme.a11y.trapFocusHandlers.keydown);

      if (elementToFocus && typeof elementToFocus.focus === 'function') elementToFocus.focus();
    }
  };

  theme.utils = {
    throttle: (callback) => {
      let requestId = null, lastArgs;
      const later = (context) => () => {
        requestId = null;
        callback.apply(context, lastArgs);
      };
      const throttled = (...args) => {
        lastArgs = args;
        if (requestId === null) {
          requestId = requestAnimationFrame(later(this));
        }
      };
      throttled.cancel = () => {
        cancelAnimationFrame(requestId);
        requestId = null;
      };
      return throttled;
    },

    debounce: (fn, wait) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    waitForEvent: (element, eventName) => {
      return new Promise((resolve) => {
        const done = (event) => {
          if (event.target === element) {
            element.removeEventListener(eventName, done);
            resolve(event);
          }
        };
        element.addEventListener(eventName, done);
      });
    },

    fetchConfig: (type = 'json', method = 'POST') => {
      return {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
      };
    },

    postLink: (path, options) => {
      options = options || {};
      const method = options['method'] || 'post';
      const params = options['parameters'] || {};

      const form = document.createElement("form");
      form.setAttribute("method", method);
      form.setAttribute("action", path);

      for (const key in params) {
        const hiddenField = document.createElement("input");
        hiddenField.setAttribute("type", "hidden");
        hiddenField.setAttribute("name", key);
        hiddenField.setAttribute("value", params[key]);
        form.appendChild(hiddenField);
      }
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    },

    postLink2: (path, options) => {
      options = options || {};
      const method = options['method'] || 'post';
      const params = options['parameters'] || {};

      const form = document.createElement("form");
      form.setAttribute("method", method);
      form.setAttribute("action", path);

      for (const key in params) {
        if (typeof params[key] === 'string') {
          const hiddenField = document.createElement("input");
          hiddenField.setAttribute("type", "hidden");
          hiddenField.setAttribute("name", key);
          hiddenField.setAttribute("value", params[key]);
          form.appendChild(hiddenField);
        }
        else {
          for (const index in params[key]) {
            for (const key2 in params[key][index]) {
              const hiddenField = document.createElement("input");
              hiddenField.setAttribute("type", "hidden");
              hiddenField.setAttribute("name", `${key}[${index}][${key2}]`);
              hiddenField.setAttribute("value", params[key][index][key2]);
              form.appendChild(hiddenField);
            }
          }
        }
      }
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    },

    sectionId: (element) => {
      if (element.hasAttribute('data-section-id')) return element.getAttribute('data-section-id');

      element = element.classList.contains('shopify-section') ? element : element.closest('.shopify-section');
      return element.id.replace('shopify-section-', '');
    },

    imageLoaded: (imageOrArray) => {
      if (!imageOrArray) {
        return Promise.resolve();
      }
      imageOrArray = imageOrArray instanceof Element ? [imageOrArray] : Array.from(imageOrArray);
      return Promise.all(imageOrArray.map((image) => {
        return new Promise((resolve) => {
          if (image.tagName === "IMG" && image.complete || !image.offsetParent) {
            resolve();
          } else {
            image.onload = () => resolve();
          }
        });
      }));
    },

    visibleMedia: (media) => {
      return Array.from(media).find((item) => {
        const style = window.getComputedStyle(item);
        return style.display !== 'none';
      });
    },

    externalLinksNewTab: () => {
      if (theme.settings.externalLinksNewTab) {
        document.addEventListener('click', (evt) => {
          const link = evt.target.tagName === 'A' ? evt.target : evt.target.closest('a');
          if (link && link.tagName === 'A' && window.location.hostname !== new URL(link.href).hostname) {
            link.target = '_blank';
          }
        });
      }
    }
  };

  theme.HTMLUpdateUtility = {
    /**
     * Used to swap an HTML node with a new node.
     * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
     *
     * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
     */
    viewTransition: (oldNode, newContent, preProcessCallbacks = [], postProcessCallbacks = []) => {
      preProcessCallbacks?.forEach((callback) => callback(newContent));

      const newNodeWrapper = document.createElement('div');
      theme.HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
      const newNode = newNodeWrapper.firstChild;

      // dedupe IDs
      const uniqueKey = Date.now();
      oldNode.querySelectorAll('[id], [form]').forEach((element) => {
        element.id && (element.id = `${element.id}-${uniqueKey}`);
        element.form && element.setAttribute('form', `${element.form.getAttribute('id')}-${uniqueKey}`);
      });

      oldNode.parentNode.insertBefore(newNode, oldNode);
      oldNode.style.display = 'none';

      postProcessCallbacks?.forEach((callback) => callback(newNode));

      setTimeout(() => oldNode.remove(), 500);
    },

    // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
    setInnerHTML: (element, html) => {
      element.innerHTML = html;
      element.querySelectorAll('script').forEach((oldScriptTag) => {
        const newScriptTag = document.createElement('script');
        Array.from(oldScriptTag.attributes).forEach((attribute) => {
          newScriptTag.setAttribute(attribute.name, attribute.value);
        });
        newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
        oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
      });
    }
  };

  theme.Currency = {
    formatMoney: (cents, format = "") => {
      if (typeof cents === "string") {
        cents = cents.replace(".", "");
      }
      const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/, formatString = format || window.themeVariables.settings.moneyFormat;
      function defaultTo(value2, defaultValue) {
        return value2 == null || value2 !== value2 ? defaultValue : value2;
      }
      function formatWithDelimiters(number, precision, thousands, decimal) {
        precision = defaultTo(precision, 2);
        thousands = defaultTo(thousands, ",");
        decimal = defaultTo(decimal, ".");
        if (isNaN(number) || number == null) {
          return 0;
        }
        number = (number / 100).toFixed(precision);
        let parts = number.split("."), dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + thousands), centsAmount = parts[1] ? decimal + parts[1] : "";
        return dollarsAmount + centsAmount;
      }
      let value = "";
      switch (formatString.match(placeholderRegex)[1]) {
        case "amount":
          value = formatWithDelimiters(cents, 2);
          break;
        case "amount_no_decimals":
          value = formatWithDelimiters(cents, 0);
          break;
        case "amount_with_space_separator":
          value = formatWithDelimiters(cents, 2, " ", ".");
          break;
        case "amount_with_comma_separator":
          value = formatWithDelimiters(cents, 2, ".", ",");
          break;
        case "amount_with_apostrophe_separator":
          value = formatWithDelimiters(cents, 2, "'", ".");
          break;
        case "amount_no_decimals_with_comma_separator":
          value = formatWithDelimiters(cents, 0, ".", ",");
          break;
        case "amount_no_decimals_with_space_separator":
          value = formatWithDelimiters(cents, 0, " ");
          break;
        case "amount_no_decimals_with_apostrophe_separator":
          value = formatWithDelimiters(cents, 0, "'");
          break;
        default:
          value = formatWithDelimiters(cents, 2);
          break;
      }
      if (formatString.indexOf("with_comma_separator") !== -1) {
        return formatString.replace(placeholderRegex, value);
      } else {
        return formatString.replace(placeholderRegex, value);
      }
    }
  };

  theme.pubsub = {
    PUB_SUB_EVENTS: {
      cartUpdate: 'cartUpdate',
      quantityUpdate: 'quantityUpdate',
      variantChange: 'variantChange',
      cartError: 'cartError',
      discountUpdate: 'discountUpdate',
      facetUpdate: 'facetUpdate',
      quantityRules: 'quantityRules',
      quantityBoundries: 'quantityBoundries',
      optionValueSelectionChange: 'optionValueSelectionChange',
    },

    subscribers: {},

    subscribe: (eventName, callback) => {
      if (theme.pubsub.subscribers[eventName] === undefined) {
        theme.pubsub.subscribers[eventName] = [];
      }

      theme.pubsub.subscribers[eventName] = [...theme.pubsub.subscribers[eventName], callback];

      return function unsubscribe() {
        theme.pubsub.subscribers[eventName] = theme.pubsub.subscribers[eventName].filter((cb) => {
          return cb !== callback
        });
      }
    },

    publish: (eventName, data) => {
      if (theme.pubsub.subscribers[eventName]) {
        theme.pubsub.subscribers[eventName].forEach((callback) => {
          callback(data);
        })
      }
    }
  };

  theme.scrollShadow = {
    Updater: (function () {
      class Updater {
        constructor(targetElement) {
          this.cb = () => this.update(targetElement);
          this.rO = new ResizeObserver(this.cb);
          this.mO = new MutationObserver(() => this.on(this.el));
        }
        on(element) {
          if (this.el) {
            this.el.removeEventListener("scroll", this.cb);
            this.rO.disconnect();
            this.mO.disconnect();
          }
          if (!element)
            return;
          if (element.nodeName === "TABLE" && !/scroll|auto/.test(getComputedStyle(element).getPropertyValue("overflow"))) {
            this.rO.observe(element);
            element = element.tBodies[0];
          }
          element.addEventListener("scroll", this.cb);
          [element, ...element.children].forEach((el) => this.rO.observe(el));
          this.mO.observe(element, { childList: true });
          this.el = element;
        }
        update(targetElement) {
          const scrollTop = this.el.scrollTop;
          const scrollBottom = this.el.scrollHeight - this.el.offsetHeight - this.el.scrollTop;
          const scrollLeft = this.el.scrollLeft;
          const scrollRight = this.el.scrollWidth - this.el.offsetWidth - this.el.scrollLeft * (theme.config.rtl ? -1 : 1);
          let cssText = `--t: ${Math.floor(scrollTop) > 0 ? 1 : 0}; --b: ${Math.floor(scrollBottom) > 0 ? 1 : 0}; --l: ${Math.floor(scrollLeft) > 0 ? 1 : 0}; --r: ${Math.floor(scrollRight) > 0 ? 1 : 0};`;
          if (this.el.nodeName === "TBODY") {
            const clientRect = this.el.getBoundingClientRect();
            const rootClientRect = this.el.parentElement.getBoundingClientRect();
            cssText += `top: ${clientRect.top - rootClientRect.top}px; bottom: ${rootClientRect.bottom - clientRect.bottom}px; left: ${clientRect.left - rootClientRect.left}px; right: ${rootClientRect.right - clientRect.right}px;`;
          }
          requestAnimationFrame(() => {
            targetElement.style.cssText = cssText;
          });
        }
      }

      return Updater;
    })()
  };

  theme.cookiesEnabled = function () {
    let cookieEnabled = navigator.cookieEnabled;

    if (!cookieEnabled) {
      document.cookie = 'testcookie';
      cookieEnabled = document.cookie.indexOf('testcookie') !== -1;
    }
    return cookieEnabled;
  };

  theme.isStorageSupported = function (type) {
    // Return false if we are in an iframe without access to sessionStorage
    if (window.self !== window.top) {
      return false;
    }

    const testKey = 'test';
    let storage;
    if (type === 'session') {
      storage = window.sessionStorage;
    }
    if (type === 'local') {
      storage = window.localStorage;
    }

    try {
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return true;
    }
    catch (error) {
      // Do nothing, this may happen in Safari in incognito mode
      return false;
    }
  };

  theme.getElementWidth = function (element, value) {
    const style = window.getComputedStyle(element);

    const text = document.createElement('span');
    text.style.fontFamily = style.fontFamily;
    text.style.fontSize = style.fontSize;
    text.style.fontWeight = style.fontWeight;
    text.style.visibility = 'hidden';
    text.style.position = 'absolute';
    text.innerHTML = value;

    document.body.appendChild(text);
    const width = text.getBoundingClientRect().width;
    text.remove();

    return width;
  };

  theme.HoverButton = (function () {
    class HoverButton {
      constructor(container) {
        this.container = container;

        this.onEnterHandler = this.onEnterHandler.bind(this);
        this.onLeaveHandler = this.onLeaveHandler.bind(this);
      }

      get btnFill() {
        return this.container.querySelector('[data-fill]');
      }

      load() {
        if (document.body.getAttribute('data-button-hover') === 'none') return;
        if (!window.matchMedia('(any-hover: hover)').matches) return;

        this.container.addEventListener('pointerenter', this.onEnterHandler);
        this.container.addEventListener('pointerleave', this.onLeaveHandler);
      }

      onEnterHandler(event) {
        if (event.pointerType === 'touch') return;

        if (this.btnFill) {
          Motion.animate(this.btnFill, { y: ['76%', '0%'] }, { duration: 0.6 });
        }
      }

      onLeaveHandler(event) {
        if (event.pointerType === 'touch') return;

        if (this.btnFill) {
          Motion.animate(this.btnFill, { y: '-76%' }, { duration: 0.6 });
        }
      }

      unload() {
        this.container.removeEventListener('pointerenter', this.onEnterHandler);
        this.container.removeEventListener('pointerleave', this.onLeaveHandler);
      }
    }

    return HoverButton;
  })();

  theme.MagnetButton = (function () {
    const config = {
      magnet: 10
    };

    class MagnetButton {
      constructor(container) {
        this.container = container;
        this.magnet = container.hasAttribute('data-magnet') ? parseInt(container.getAttribute('data-magnet')) : config.magnet;

        this.onMoveHandler = this.onMoveHandler.bind(this);
        this.onLeaveHandler = this.onLeaveHandler.bind(this);
      }

      get btnText() {
        return this.container.querySelector('[data-text]');
      }

      get bounding() {
        return this.container.getBoundingClientRect();
      }

      load() {
        if (document.body.getAttribute('data-button-hover') === 'none') return;
        if (!window.matchMedia('(any-hover: hover)').matches) return;

        this.container.addEventListener('pointermove', this.onMoveHandler);
        this.container.addEventListener('pointerleave', this.onLeaveHandler);
      }

      onMoveHandler(event) {
        if (event.pointerType === 'touch') return;
        if (theme.config.motionReduced) return;
        if (this.magnet === 0) return;

        if (this.btnText) {
          Motion.animate(this.btnText, {
            x: ((event.clientX - this.bounding.left) / this.container.offsetWidth - 0.5) * this.magnet,
            y: ((event.clientY - this.bounding.top) / this.container.offsetHeight - 0.5) * this.magnet,
          }, { duration: 1.5, easing: Motion.spring() });
        }
        else {
          Motion.animate(this.container, {
            x: ((event.clientX - this.bounding.left) / this.container.offsetWidth - 0.5) * this.magnet,
            y: ((event.clientY - this.bounding.top) / this.container.offsetHeight - 0.5) * this.magnet,
          }, { duration: 1.5, easing: Motion.spring() });
        }
      }

      onLeaveHandler(event) {
        if (event.pointerType === 'touch') return;
        if (theme.config.motionReduced) return;
        if (this.magnet === 0) return;

        if (this.btnText) {
          Motion.animate(this.btnText, { x: 0, y: 0 }, { duration: 1.5, easing: Motion.spring() });
        }
        else {
          Motion.animate(this.container, { x: 0, y: 0 }, { duration: 1.5, easing: Motion.spring() });
        }
      }

      unload() {
        this.container.removeEventListener('pointermove', this.onMoveHandler);
        this.container.removeEventListener('pointerleave', this.onLeaveHandler);
      }
    }

    return MagnetButton;
  })();

  theme.RevealButton = (function () {
    const config = {
      magnet: 25
    };

    class RevealButton {
      constructor(container) {
        this.container = container;
        this.magnet = container.hasAttribute('data-magnet') ? parseInt(container.getAttribute('data-magnet')) : config.magnet;

        this.onMoveHandler = this.onMoveHandler.bind(this);
        this.onLeaveHandler = this.onLeaveHandler.bind(this);
      }

      get btnText() {
        return this.container.querySelector('[data-text]');
      }

      get btnReveal() {
        return this.container.querySelector('[data-reveal]');
      }

      get bounding() {
        return this.container.getBoundingClientRect();
      }

      load() {
        if (!window.matchMedia('(any-hover: hover)').matches) return;

        this.container.addEventListener('pointermove', this.onMoveHandler);
        this.container.addEventListener('pointerleave', this.onLeaveHandler);
      }

      onMoveHandler(event) {
        if (event.pointerType === 'touch') return;

        if (this.btnReveal) {
          Motion.animate(this.btnReveal, {
            opacity: 1,
            x: ((event.clientX - this.bounding.left) / this.container.offsetWidth - 0.5) * this.magnet,
            y: ((event.clientY - this.bounding.top) / this.container.offsetHeight - 0.5) * this.magnet,
          }, { duration: 0.2, easing: 'steps(2, start)' });
        }
        else if (this.btnText) {
          Motion.animate(this.btnText, {
            x: ((event.clientX - this.bounding.left) / this.container.offsetWidth - 0.5) * this.magnet,
            y: ((event.clientY - this.bounding.top) / this.container.offsetHeight - 0.5) * this.magnet,
          }, { duration: 1.5, easing: Motion.spring() });
        }
        else {
          Motion.animate(this.container, {
            x: ((event.clientX - this.bounding.left) / this.container.offsetWidth - 0.5) * this.magnet,
            y: ((event.clientY - this.bounding.top) / this.container.offsetHeight - 0.5) * this.magnet,
          }, { duration: 1.5, easing: Motion.spring() });
        }
      }

      onLeaveHandler(event) {
        if (event.pointerType === 'touch') return;

        if (this.btnReveal) {
          Motion.animate(this.btnReveal, { x: 0, y: 0, opacity: 0 }, { duration: 0.2, easing: [0.61, 1, 0.88, 1] });
        }
        else if (this.btnText) {
          Motion.animate(this.btnText, { x: 0, y: 0 }, { duration: 1.5, easing: Motion.spring() });
        }
        else {
          Motion.animate(this.container, { x: 0, y: 0 }, { duration: 1.5, easing: Motion.spring() });
        }
      }

      unload() {
        this.container.removeEventListener('pointermove', this.onMoveHandler);
        this.container.removeEventListener('pointerleave', this.onLeaveHandler);
      }
    }

    return RevealButton;
  })();

  theme.Animation = (function () {
    class Animation {
      constructor(container) {
        this.container = container;
      }

      get immediate() {
        return this.container.hasAttribute('data-immediate');
      }

      get media() {
        return Array.from(this.container.querySelectorAll('img, iframe, svg, g-map'));
      }

      get type() {
        return this.container.hasAttribute('data-animate') ? this.container.getAttribute('data-animate') : 'fade-up';
      }

      get delay() {
        return this.container.hasAttribute('data-animate-delay') ? parseInt(this.container.getAttribute('data-animate-delay')) / 1000 : 0;
      }

      get paused() {
        return this.container.hasAttribute('paused');
      }

      beforeLoad() {
        if (this.type === 'none' || this.paused) return;

        switch (this.type) {
          case 'fade-in':
            Motion.animate(this.container, { opacity: 0 }, { duration: 0 });
            break;

          case 'fade-up':
            Motion.animate(this.container, { transform: 'translateY(min(2rem, 90%))', opacity: 0 }, { duration: 0 });
            break;

          case 'fade-up-large':
            Motion.animate(this.container, { transform: 'translateY(90%)', opacity: 0 }, { duration: 0 });
            break;

          case 'zoom-out':
            Motion.animate(this.container, { transform: 'scale(1.3)' }, { duration: 0 });
            break;
        }
      }

      async load() {
        if (this.type === 'none' || this.paused) return;

        switch (this.type) {
          case 'fade-in':
            await Motion.animate(this.container, { opacity: 1 }, { duration: 1.5, delay: this.delay, easing: [0.16, 1, 0.3, 1] }).finished;
            break;

          case 'fade-up':
            await Motion.animate(this.container, { transform: 'translateY(0)', opacity: 1 }, { duration: 1.5, delay: this.delay, easing: [0.16, 1, 0.3, 1] }).finished;
            break;

          case 'fade-up-large':
            await Motion.animate(this.container, { transform: 'translateY(0)', opacity: 1 }, { duration: 1, delay: this.delay, easing: [0.16, 1, 0.3, 1] }).finished;
            break;

          case 'zoom-out':
            await Motion.animate(this.container, { transform: 'scale(1)' }, { duration: 1.3, delay: this.delay, easing: [0.16, 1, 0.3, 1] }).finished;
            break;
        }

        this.container.classList.add('animated');
      }

      async reset(duration) {
        if (this.type === 'none') return;

        switch (this.type) {
          case 'fade-in':
            await Motion.animate(this.container, { opacity: 0 }, { duration: duration ? duration : 1.5, delay: this.delay, easing: duration ? 'none' : [0.16, 1, 0.3, 1] }).finished;
            break;

          case 'fade-up':
            await Motion.animate(this.container, { transform: 'translateY(max(-2rem, -90%))', opacity: 0 }, { duration: duration ? duration : 1.5, delay: this.delay, easing: duration ? 'none' : [0.16, 1, 0.3, 1] }).finished;
            break;

          case 'fade-up-large':
            await Motion.animate(this.container, { transform: 'translateY(-90%)', opacity: 0 }, { duration: duration ? duration : 1, delay: this.delay, easing: duration ? 'none' : [0.16, 1, 0.3, 1] }).finished;
            break;

          case 'zoom-out':
            await Motion.animate(this.container, { transform: 'scale(0)' }, { duration: duration ? duration : 1.3, delay: this.delay, easing: duration ? 'none' : [0.16, 1, 0.3, 1] }).finished;
            break;
        }

        this.container.classList.remove('animated');
      }

      reload() {
        if (this.type === 'none') return;

        this.container.removeAttribute('paused');
        this.beforeLoad();
        this.load();
      }

      unload() {
        // todo
      }
    }

    return Animation;
  })();

  theme.Carousel = (function () {
    class Carousel {
      constructor(container, options, navigation) {
        this.container = container;
        this.options = options;
        this.prevButton = navigation.previous;
        this.nextButton = navigation.next;
      }

      load() {
        this.slider = new Flickity(this.container, this.options);

        this.onPrevButtonClickHandler = this.onPrevButtonClick.bind(this);
        this.onNextButtonClickHandler = this.onNextButtonClick.bind(this);
        this.prevButton.addEventListener('click', this.onPrevButtonClickHandler);
        this.nextButton.addEventListener('click', this.onNextButtonClickHandler);

        this.slider.on('dragStart', this.onDragStartHandler.bind(this));
        this.slider.on('select', this.onSelectHandler.bind(this));
      }

      onDragStartHandler() {
        this.prevRemoveTransform();
        this.nextRemoveTransform();
      }

      onSelectHandler() {
        if (!this.slider.slides[this.slider.selectedIndex - 1]) {
          this.prevButton.disabled = true;
          this.nextButton.disabled = false;
        }
        else if (!this.slider.slides[this.slider.selectedIndex + 1]) {
          this.prevButton.disabled = false;
          this.nextButton.disabled = true;
        }
        else {
          this.prevButton.disabled = false;
          this.nextButton.disabled = false;
        }
      }

      onPrevButtonClick(event) {
        event.preventDefault();

        this.slider.previous();
        this.nextRemoveTransform();
      }

      onNextButtonClick(event) {
        event.preventDefault();

        this.slider.next();
        this.prevRemoveTransform();
      }

      prevRemoveTransform() {
        this.prevButton.style.transform = null;
        this.prevButton.querySelector('[data-fill]').style.transform = null;
      }

      nextRemoveTransform() {
        this.nextButton.style.transform = null;
        this.nextButton.querySelector('[data-fill]').style.transform = null;
      }

      unload() {
        if (this.slider) this.slider.destroy();
        this.prevButton?.removeEventListener('click', this.onPrevButtonClickHandler);
        this.nextButton?.removeEventListener('click', this.onNextButtonClickHandler);
      }
    }

    return Carousel;
  })();

  // Delay JavaScript until user interaction
  theme.initWhenVisible = class {
    #triggered = false;
    #timeoutId = null;
    #callback;
    #handle;
    #events = ['click', 'mousemove', 'keydown', 'touchstart', 'touchmove', 'wheel'];

    constructor(callback, delay = 5000) {
      if (typeof callback !== 'function') return;

      this.#callback = callback;
      this.#handle = this.#onInteraction.bind(this);

      this.#events.forEach((eventType) => {
        window.addEventListener(eventType, this.#handle, { passive: true });
      });

      this.#timeoutId = setTimeout(() => {
        this.#onInteraction({ type: 'timeout' });
      }, delay);
    }

    #onInteraction(event) {
      if (this.#triggered) return;

      this.#triggered = true;
      this.#callback(event);
      this.#cleanup();
    }

    #cleanup() {
      this.#events.forEach((eventType) => {
        window.removeEventListener(eventType, this.#handle);
      });

      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
      this.#callback = null;
    }
  };

  // Improve initial load time by skipping the rendering of offscreen content
  {
    const revealEvents = ['click', 'mousemove', 'keydown', 'touchstart', 'touchmove', 'wheel'];
    const reveal = () => {
      revealEvents.forEach((type) => window.removeEventListener(type, reveal));
      const run = () => document.body.removeAttribute('data-page-rendering');

      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 1000 });
      } else {
        setTimeout(run, 0);
      }
    };
    revealEvents.forEach((type) => window.addEventListener(type, reveal, { passive: true }));
  }

  // Improve iOS Safari resizing
  theme.windowWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const { innerWidth } = window;
    if (innerWidth !== theme.windowWidth) {
      theme.windowWidth = innerWidth;
      document.dispatchEvent(new CustomEvent('window:resize'));
    }
  });

  theme.DOMready(theme.headerGroup.init);
  theme.DOMready(theme.utils.externalLinksNewTab);

  /*============================================================================
    Things that don't require DOM to be ready
  ==============================================================================*/

  theme.config.hasSessionStorage = theme.isStorageSupported('session');
  theme.config.hasLocalStorage = theme.isStorageSupported('local');

  // Trigger events when going between breakpoints
  const mql = window.matchMedia(theme.config.mediaQuerySmall);
  theme.config.mqlSmall = mql.matches;
  mql.onchange = (mql) => {
    if (mql.matches) {
      theme.config.mqlSmall = true;
      document.dispatchEvent(new CustomEvent('matchSmall'));
    }
    else {
      theme.config.mqlSmall = false;
      document.dispatchEvent(new CustomEvent('unmatchSmall'));
    }
  }

  // Page has loaded and theme assets are ready
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');
    document.dispatchEvent(new CustomEvent('page:loaded'));
  });
  window.addEventListener('pageshow', (event) => {
    // Removes unload class when returning to page via history
    if (event.persisted) {
      document.body.classList.remove('unloading');
    }
  });
  window.addEventListener('beforeunload', () => {
    document.body.classList.add('unloading');
  });
})();

// Prevent vertical scroll while using flickity sliders
new theme.initWhenVisible(() => {
  var e = !1;
  var t;

  document.body.addEventListener('touchstart', function (i) {
    if (!i.target.closest('.flickity-slider')) {
      return e = !1;
      void 0;
    }
    e = !0;
    t = {
      x: i.touches[0].pageX,
      y: i.touches[0].pageY
    }
  }, theme.supportsPassive ? { passive: true } : false);

  document.body.addEventListener('touchmove', function (i) {
    if (e && i.cancelable) {
      var n = {
        x: i.touches[0].pageX - t.x,
        y: i.touches[0].pageY - t.y
      };
      Math.abs(n.x) > Flickity.defaults.dragThreshold && i.preventDefault()
    }
  }, theme.supportsPassive ? { passive: false } : false);
});

const BaseElementMixin = (Base) => class extends Base {
  connectedCallback() {
    this.eventsController ??= new AbortController();
  }

  disconnectedCallback() {
    this.eventsController?.abort();
    this.eventsController = null;

    if (this._cleanups) {
      while (this._cleanups.length) {
        try {
          this._cleanups.pop()();
        } catch (error) {
          console.error('[BaseElement] cleanup failed', error);
        }
      }
    }
  }

  on(target, type, handler, options = {}) {
    this.eventsController ??= new AbortController();
    target.addEventListener(type, handler, { ...options, signal: this.eventsController.signal });
    return handler;
  }

  registerCleanup(teardown) {
    if (typeof teardown === 'function') (this._cleanups ??= []).push(teardown);
    return teardown;
  }
};

class BaseElement extends BaseElementMixin(HTMLElement) { }

class LoadingBar extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.on(document, 'page:loaded', () => {
      Motion.animate(this, { opacity: 0 }, { duration: 1 }).finished.then(() => {
        this.hidden = true;
      });
    });
  }
}
customElements.define('loading-bar', LoadingBar);

class MouseCursor extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    if (theme.config.isTouch) return;

    this.config = {
      posX: 0,
      posY: 0,
    };

    const onMouseMove = theme.utils.throttle((event) => {
      this.config.posX += (event.clientX - this.config.posX) / 4;
      this.config.posY += (event.clientY - this.config.posY) / 4;

      this.style.setProperty('--x', `${this.config.posX}px`);
      this.style.setProperty('--y', `${this.config.posY}px`);
    });
    this.on(document, 'mousemove', onMouseMove, { passive: true });
    this.registerCleanup(() => onMouseMove.cancel());
  }
}
customElements.define('mouse-cursor', MouseCursor);

class CustomHeader extends BaseElement {

  get allowTransparent() {
    if (document.querySelector('.shopify-section:first-child [allow-transparent-header]')) {
      return true;
    }

    return false;
  }

  get headerSection() {
    return document.querySelector('.header-section');
  }

  connectedCallback() {
    super.connectedCallback();

    this.init();
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(this.setHeight.bind(this));
      resizeObserver.observe(this);
      this.registerCleanup(() => resizeObserver.disconnect());
    }

    if (Shopify.designMode) {
      const section = this.closest('.shopify-section');
      this.on(section, 'shopify:section:load', this.init.bind(this));
      this.on(section, 'shopify:section:unload', this.init.bind(this));
      this.on(section, 'shopify:section:reorder', this.init.bind(this));
    }
  }

  init() {
    this.setHeight();

    if (this.allowTransparent) {
      this.headerSection.classList.add('header-transparent');
      this.headerSection.classList.add('no-animate');

      setTimeout(() => {
        this.headerSection.classList.remove('no-animate');
      }, 500);
    }
    else {
      this.headerSection.classList.remove('header-transparent');
    }
  }

  setHeight() {
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--header-height', this.getBoundingClientRect().height.toFixed(1) + 'px');

      if (this.classList.contains('header--center') && document.documentElement.style.getPropertyValue('--header-nav-height').length === 0) {
        document.documentElement.style.setProperty('--header-nav-height', Math.round(document.getElementById('MenuToggle')?.clientHeight) + 'px');
      }
    });
  }
}
customElements.define('custom-header', CustomHeader, { extends: 'header' });

class StickyHeader extends CustomHeader {
  constructor() {
    super();
    this.isScrolled = false; // Track scroll state to prevent class toggling
    this.buffer = 10; // Pixel buffer to create smooth transition zone
  }

  get isAlwaysSticky() {
    return this.getAttribute('data-sticky-type') === 'always';
  }

  connectedCallback() {
    super.connectedCallback();

    // Initialize scroll tracking values
    this.currentScrollTop = 0;
    this.firstScrollTop = window.scrollY;
    this.initialHeaderHeight = this.getBoundingClientRect().height; // Cache initial height
    this.headerBounds = this.headerSection.getBoundingClientRect();

    this.on(this.headerSection, 'transitionend', (event) => {
      if (event.propertyName === 'padding-block-end' || event.propertyName === 'padding-bottom') {
        this.updateStickyHeight();
      }
    });

    this.beforeInit();
  }

  beforeInit() {
    this.headerSection.classList.add('header-sticky');
    this.headerSection.setAttribute('data-sticky-type', this.getAttribute('data-sticky-type'));

    if (this.isAlwaysSticky) {
      this.headerSection.classList.add('header-sticky');
    }

    const onScroll = theme.utils.throttle(this.onScrollHandler.bind(this));
    this.on(window, 'scroll', onScroll, { passive: true });
    this.registerCleanup(() => onScroll.cancel());
  }

  updateStickyHeight() {
    if (this.isScrolled) {
      document.documentElement.style.setProperty('--sticky-header-height', this.getBoundingClientRect().height.toFixed(1) + 'px');
    }
  }

  onScrollHandler() {
    const scrollTop = window.scrollY;

    // Calculate scroll thresholds based on initial header height (prevents changing thresholds)
    const scrollThreshold = this.headerBounds.top + this.firstScrollTop + this.initialHeaderHeight;
    const scrollThresholdNav = this.headerBounds.top + this.firstScrollTop + this.initialHeaderHeight * 2;

    // Hysteresis: Different thresholds for scrolling down vs up prevents rapid toggling
    const scrollDownThreshold = scrollThreshold + this.buffer;
    const scrollUpThreshold = scrollThreshold - this.buffer;

    // Toggle 'header-scrolled' class with buffer zone
    if (!this.isScrolled && scrollTop > scrollDownThreshold) {
      // Scrolling down past threshold
      this.isScrolled = true;
      this.headerSection.classList.add('header-scrolled');
      document.dispatchEvent(new CustomEvent('header:scrolled', { bubbles: true, detail: { scrolled: true } }));
    }
    else if (this.isScrolled && scrollTop < scrollUpThreshold) {
      // Scrolling up past threshold
      this.isScrolled = false;
      this.headerSection.classList.remove('header-scrolled');
      this.headerSection.classList.remove('header-nav-scrolled');
      document.dispatchEvent(new CustomEvent('header:scrolled', { bubbles: true, detail: { scrolled: false } }));
    }

    // Add 'header-nav-scrolled' when scrolled past 2x header height
    if (this.isScrolled && scrollTop > scrollThresholdNav) {
      this.headerSection.classList.add('header-nav-scrolled');

      // Close any open dropdown menus
      this.headerSection.querySelectorAll('details').forEach((details) => {
        if (details.hasAttribute('open')) {
          details.open = false;
        }
      });
    }

    // Hide header when scrolling down, show when scrolling up
    if (scrollTop > (this.headerBounds.bottom + this.firstScrollTop + 100)) {
      if (scrollTop > this.currentScrollTop) {
        // Scrolling down - hide header
        this.headerSection.classList.add('header-hidden');
      }
      else {
        // Scrolling up - show header
        this.headerSection.classList.remove('header-hidden');
      }
    }
    else {
      // Near top of page - always show header
      this.headerSection.classList.remove('header-hidden');
    }

    // Update current scroll position for next comparison
    this.currentScrollTop = scrollTop;
  }
}
customElements.define('sticky-header', StickyHeader, { extends: 'header' });

class RevealLink extends HTMLAnchorElement {
  constructor() {
    super();

    this.revealButton = new theme.RevealButton(this);
    this.revealButton.load();
  }
}
customElements.define('reveal-link', RevealLink, { extends: 'a' });

class HoverLink extends BaseElementMixin(HTMLAnchorElement) {
  constructor() {
    super();

    this.hoverButton = new theme.HoverButton(this);
    this.hoverButton.load();
  }
}
customElements.define('hover-link', HoverLink, { extends: 'a' });

class MagnetLink extends HoverLink {
  constructor() {
    super();

    this.magnetButton = new theme.MagnetButton(this);
    this.magnetButton.load();
  }
}
customElements.define('magnet-link', MagnetLink, { extends: 'a' });

class HoverButton extends BaseElementMixin(HTMLButtonElement) {
  constructor() {
    super();

    this.hoverButton = new theme.HoverButton(this);
    this.hoverButton.load();

    Motion.inView(this, this.init.bind(this));
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.type === 'submit' && this.form) {
      this.on(this.form, 'submit', () => this.setAttribute('aria-busy', 'true'));
    }
    this.on(window, 'pageshow', () => this.removeAttribute('aria-busy'));
  }

  static get observedAttributes() {
    return ['aria-busy'];
  }

  get contentElement() {
    return this._contentElement = this._contentElement || this.querySelector('.btn-text');
  }

  get animationElement() {
    return this._animationElement = this._animationElement || document.createRange().createContextualFragment(`
      <span class="btn-loader">
        <span></span>
        <span></span>
        <span></span>
      </span>
    `).firstElementChild;
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  init() {
    this.append(this.animationElement);
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if (newValue === 'true') {
      Motion.timeline([
        [this.contentElement, { opacity: 0 }, { duration: 0.15 }],
        [this.animationElement, { opacity: 1 }, { duration: 0.15 }]
      ]);
      this.loaderAnimation = Motion.animate(this.animationElement.children, { transform: ['scale(1.6)', 'scale(0.6)'] }, { duration: 0.35, delay: Motion.stagger(0.35 / 2), direction: 'alternate', repeat: Infinity });
    }
    else {
      this.loaderAnimation?.stop();
      this.loaderAnimation = null;
      Motion.timeline([
        [this.animationElement, { opacity: 0 }, { duration: 0.15 }],
        [this.contentElement, { opacity: 1 }, { duration: 0.15 }]
      ]);
    }
  }
}
customElements.define('hover-button', HoverButton, { extends: 'button' });

class MagnetButton extends HoverButton {
  constructor() {
    super();

    this.magnetButton = new theme.MagnetButton(this);
    this.magnetButton.load();
  }
}
customElements.define('magnet-button', MagnetButton, { extends: 'button' });

class HoverElement extends HTMLElement {
  constructor() {
    super();

    this.hoverButton = new theme.HoverButton(this);
    this.hoverButton.load();
  }
}
customElements.define('hover-element', HoverElement);

class MagnetElement extends HoverElement {
  constructor() {
    super();

    this.magnetButton = new theme.MagnetButton(this);
    this.magnetButton.load();
  }
}
customElements.define('magnet-element', MagnetElement);

class AnimateElement extends HTMLElement {
  constructor() {
    super();

    this.loadPromise = new Promise((resolve) => {
      this.resolveLoad = resolve;
    });
  }

  connectedCallback() {
    if (theme.config.motionReduced) {
      this.resolveLoad();
      return;
    }

    this.animation = new theme.Animation(this);
    this.animation.beforeLoad();

    if (this.animation.paused) {
      this.resolveLoad();
      return;
    }

    Motion.inView(this, async () => {
      if (!this.immediate && this.media) await theme.utils.imageLoaded(this.media);
      setTimeout(this.resolveLoad, 500);
      await this.animation.load();
      this.parentElement.classList.add('animated');
    });
  }

  reset() {
    this.animation?.reset();
  }

  refresh() {
    this.animation?.reload();
  }
}
customElements.define('animate-element', AnimateElement);

class AnimatePicture extends HTMLPictureElement {

  connectedCallback() {
    if (theme.config.motionReduced) return;

    this.animation = new theme.Animation(this);
    this.animation.beforeLoad();

    Motion.inView(this, async () => {
      if (!this.immediate && this.media) await theme.utils.imageLoaded(this.media);
      await this.animation.load();
    });
  }
}
customElements.define('animate-picture', AnimatePicture, { extends: 'picture' });

class AnnouncementBar extends BaseElement {
  constructor() {
    super();

    this.selectedIndex = this.selectedIndex;

    if (!theme.config.isTouch || Shopify.designMode) {
      Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
    }
    else {
      new theme.initWhenVisible(this.init.bind(this));
    }
  }

  static get observedAttributes() {
    return ['selected-index'];
  }

  get selectedIndex() {
    return parseInt(this.getAttribute('selected-index')) || 0;
  }

  set selectedIndex(index) {
    this.setAttribute('selected-index', Math.min(Math.max(index, 0), this.items.length - 1).toString());
  }

  get items() {
    return this._items = this._items || Array.from(this.children);
  }

  get autoplay() {
    return this.hasAttribute('autoplay');
  }

  get speed() {
    return this.hasAttribute('autoplay') ? parseInt(this.getAttribute('autoplay-speed')) * 1000 : 5000;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (this.items.length > 1) {
      this.slider = new Flickity(this, {
        accessibility: false,
        fade: true,
        pageDots: false,
        prevNextButtons: false,
        wrapAround: true,
        rightToLeft: theme.config.rtl,
        autoPlay: this.autoplay ? this.speed : false,
        on: {
          ready: function () {
            setTimeout(() => this.element.setAttribute('loaded', ''));
          }
        }
      });

      this.slider.on('change', this.onChange.bind(this));
      this.bindEvents();
    }
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  bindEvents() {
    if (!this.slider) return;

    this.on(this, 'slider:previous', () => this.slider.previous());
    this.on(this, 'slider:next', () => this.slider.next());
    this.on(this, 'slider:play', () => this.slider.playPlayer());
    this.on(this, 'slider:pause', () => this.slider.pausePlayer());

    if (Shopify.designMode) {
      this.on(this, 'shopify:block:select', (event) => this.slider.select(this.items.indexOf(event.target)));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.slider) this.slider.destroy();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'selected-index' && oldValue !== null && oldValue !== newValue) {
      const focusableEvents = 'button, [href]';

      const fromElement = this.items[parseInt(oldValue)];
      const toElement = this.items[parseInt(newValue)];

      fromElement.querySelectorAll(focusableEvents).forEach((el) => {
        el.setAttribute('tabindex', '-1');
      });
      toElement.querySelectorAll(focusableEvents).forEach((el) => {
        el.removeAttribute('tabindex');
      });
    }
  }

  onChange() {
    this.selectedIndex = this.slider.selectedIndex;
    this.dispatchEvent(new CustomEvent('slider:change', { bubbles: true, detail: { currentPage: this.slider.selectedIndex } }));
  }
}
customElements.define('announcement-bar', AnnouncementBar);

class AccordionsDetails extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'toggle', this.onToggle);
  }

  get items() {
    return this._items = this._items || Array.from(this.querySelectorAll('details[is="accordion-details"]'));
  }

  onToggle(event) {
    const { current: target, open } = event.detail;
    this.items.forEach((item) => {
      if (item !== target) {
        item.close();
      }
    });

    if (open) {
      let headerHeight = 0;
      if (!theme.config.mqlSmall && document.querySelector('header.header')) {
        headerHeight = Math.round(document.querySelector('header.header').clientHeight);
      }
      setTimeout(() => {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY - headerHeight,
          behavior: theme.config.motionReduced ? 'auto' : 'smooth'
        });
      }, 250);
    }
  }
}
customElements.define('accordions-details', AccordionsDetails);

class AccordionDetails extends BaseElementMixin(HTMLDetailsElement) {
  constructor() {
    super();

    this._open = this.hasAttribute('open');
    this.summaryElement = this.querySelector('summary');
    this.contentElement = this.querySelector('summary + *');
    this.setAttribute('aria-expanded', this._open ? 'true' : 'false');
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this.summaryElement, 'click', this.onSummaryClick.bind(this));

    if (Shopify.designMode) {
      this.on(this, 'shopify:block:select', () => {
        if (this.designModeActive) this.open = true;
      });
      this.on(this, 'shopify:block:deselect', () => {
        if (this.designModeActive) this.open = false;
      });
    }
  }

  get designModeActive() {
    return true;
  }

  get controlledElement() {
    return this.closest('accordions-details');
  }

  static get observedAttributes() {
    return ['open'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'open') {
      this.setAttribute('aria-expanded', newValue === '' ? 'true' : 'false');
    }
  }

  get open() {
    return this._open;
  }

  set open(value) {
    if (value !== this._open) {
      this._open = value;

      if (this.isConnected) {
        this.transition(value);
      }
      else {
        value ? this.setAttribute('open', '') : this.removeAttribute('open');
      }
    }

    this.setAttribute('aria-expanded', value ? 'true' : 'false');
    this.dispatchEventHandler();
  }

  onSummaryClick(event) {
    event.preventDefault();
    this.open = !this.open;
  }

  close() {
    this._open = false;
    this.transition(false);
  }

  async transition(value) {
    this.style.overflow = 'hidden';

    if (value) {
      this.setAttribute('open', '');

      await Motion.timeline([
        [this, { height: [`${this.summaryElement.clientHeight}px`, `${this.scrollHeight}px`] }, { duration: 0.25, easing: 'ease' }],
        [this.contentElement, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0)'] }, { duration: 0.15, at: '-0.1' }]
      ]).finished;
    }
    else {
      await Motion.timeline([
        [this.contentElement, { opacity: 0 }, { duration: 0.15 }],
        [this, { height: [`${this.clientHeight}px`, `${this.summaryElement.clientHeight}px`] }, { duration: 0.25, at: '<', easing: 'ease' }]
      ]).finished;

      this.removeAttribute('open');
    }

    this.style.height = 'auto';
    this.style.overflow = 'visible';
  }

  dispatchEventHandler() {
    (this.controlledElement ?? this).dispatchEvent(new CustomEvent('toggle', { bubbles: true, detail: { current: this, open: this.open } }));
  }
}
customElements.define('accordion-details', AccordionDetails, { extends: 'details' });

class FooterDetails extends AccordionDetails {
  connectedCallback() {
    super.connectedCallback();

    this.load();
    this.on(document, 'matchSmall', this.load.bind(this));
    this.on(document, 'unmatchSmall', this.load.bind(this));
  }

  get designModeActive() {
    return theme.config.mqlSmall;
  }

  get openDefault() {
    return this.hasAttribute('data-opened');
  }

  load() {
    if (!theme.config.mqlSmall || this.openDefault) {
      this.open = true;
    }
    else {
      if (this.open && !this.openDefault) {
        this.open = false;
      }
    }
  }
}
customElements.define('footer-details', FooterDetails, { extends: 'details' });

class GestureElement extends BaseElement {
  constructor() {
    super();
    this.config = {
      thresholdY: Math.max(25, Math.floor(0.15 * window.innerHeight)),
      velocityThreshold: 10,
      disregardVelocityThresholdY: Math.floor(0.5 * this.clientHeight),
      pressThreshold: 8,
      diagonalSwipes: false,
      diagonalLimit: Math.tan(((45 * 1.5) / 180) * Math.PI),
      longPressTime: 500,
    };

    Motion.inView(this, this.init.bind(this));
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.on(this, 'touchstart', this.onTouchStart.bind(this), theme.supportsPassive ? { passive: true } : false);
    this.on(this, 'touchmove', this.onTouchMove.bind(this), theme.supportsPassive ? { passive: true } : false);
    this.on(this, 'touchend', this.onTouchEnd.bind(this), theme.supportsPassive ? { passive: true } : false);
  }

  fire(type, event) {
    this.dispatchEvent(new CustomEvent(`gesture:${type}`, { detail: { originalEvent: event } }));
  }

  onTouchStart(event) {
    this.thresholdY = this.config.thresholdY;
    this.disregardVelocityThresholdY = this.config.disregardVelocityThresholdY;
    this.touchStartY = event.changedTouches[0].screenY;
    this.touchMoveY = null;
    this.touchEndY = null;
    this.swipingDirection = null;

    // Long press.
    this.longPressTimer = setTimeout(() => this.fire('longpress', event), this.config.longPressTime);
    this.fire('panstart', event);
  }

  onTouchMove(event) {
    const touchMoveY = event.changedTouches[0].screenY - (this.touchStartY ?? 0);
    this.velocityY = touchMoveY - (this.touchMoveY ?? 0);
    this.touchMoveY = touchMoveY;
    const absTouchMoveY = Math.abs(this.touchMoveY);
    this.swipingVertical = absTouchMoveY > this.thresholdY;
    this.swipingDirection = this.swipingVertical ? 'vertical' : 'pre-vertical';

    if (absTouchMoveY > this.config.pressThreshold) {
      clearTimeout(this.longPressTimer ?? undefined);
    }
    this.fire('panmove', event);
  }

  onTouchEnd(event) {
    this.touchEndY = event.changedTouches[0].screenY;
    this.fire('panend', event);
    clearTimeout(this.longPressTimer ?? undefined);

    const y = this.touchEndY - (this.touchStartY ?? 0);
    const absY = Math.abs(y);

    if (absY > this.thresholdY) {
      this.swipedVertical = this.config.diagonalSwipes ? y <= this.config.diagonalLimit : absY > this.thresholdY;
      if (this.swipedVertical) {
        if (y < 0) {
          // Upward swipe.
          if ((this.velocityY ?? 0) < -this.config.velocityThreshold || y < -this.disregardVelocityThresholdY) {
            this.fire('swipeup', event);
          }
        } else {
          // Downward swipe.
          if ((this.velocityY ?? 0) > this.config.velocityThreshold || y > this.disregardVelocityThresholdY) {
            this.fire('swipedown', event);
          }
        }
      }
    }
  }
}
customElements.define('gesture-element', GestureElement);

class OverlayElement extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'mousemove', this.onMouseMove);
    this.on(this, 'mouseleave', this.onMouseLeave);
    this.on(this, 'mousedown', this.onMouseDown);
    this.on(this, 'mouseup', this.onMouseUp);
  }

  get cursor() {
    return document.querySelector('mouse-cursor');
  }

  onMouseMove() {
    this.cursor.classList.add('active');
    this.cursor.setAttribute('aria-hidden', 'false');
  }
  onMouseLeave() {
    this.cursor.classList.remove('active');
    this.cursor.setAttribute('aria-hidden', 'true');
  }
  onMouseDown() {
    this.cursor.classList.add('pressed');
  }
  onMouseUp() {
    this.cursor.classList.remove('pressed');
  }
}
customElements.define('overlay-element', OverlayElement);

const lockLayerCount = new WeakMap();
class ModalElement extends BaseElement {
  constructor() {
    super();

    this.events = {
      afterHide: 'modal:afterHide',
      afterShow: 'modal:afterShow',
      closeAll: 'modal:closeAll'
    };

    this.classes = {
      open: 'has-modal-open',
      opening: 'has-modal-opening'
    };
  }

  static get observedAttributes() {
    return ['id', 'open'];
  }

  get shouldLock() {
    return false;
  }

  get shouldAppendToBody() {
    return false;
  }

  get shouldCloseAll() {
    return false;
  }

  get open() {
    return this.hasAttribute('open');
  }

  get controls() {
    return Array.from(document.querySelectorAll(`[aria-controls="${this.id}"]`));
  }

  get overlay() {
    return this._overlay = this._overlay || this.querySelector('.fixed-modal');
  }

  get gesture() {
    return this._gesture = this._gesture || this.querySelector('gesture-element');
  }

  get designMode() {
    return this.hasAttribute('shopify-design-mode');
  }

  get focusElement() {
    return this.querySelector('gesture-element') || this.querySelector('button');
  }

  connectedCallback() {
    super.connectedCallback();

    this.controls.forEach((button) => this.on(button, 'click', this.onButtonClick.bind(this)));
    this.on(document, 'keyup', (event) => event.code === 'Escape' && this.hide());
    this.on(document, this.events.closeAll, () => this.hide());

    if (this.gesture) {
      this.gestureConfig = {
        animationFrame: null,
        moveY: 0,
        maxGestureDistance: 0,
        endPoint: 0,
        layerHeight: null
      };

      this.gestureWrap = this.gesture.parentElement;

      setTimeout(() => {
        this.on(this.gesture, 'gesture:panstart', this.onPanStart.bind(this));
        this.on(this.gesture, 'gesture:panmove', this.onPanMove.bind(this));
        this.on(this.gesture, 'gesture:panend', this.onPanEnd.bind(this));
      }, 75);
    }

    if (Shopify.designMode && this.designMode) {
      const section = this.closest('.shopify-section');
      this.on(section, 'shopify:section:select', (event) => this.show(null, !event.detail.load));
      this.on(section, 'shopify:section:deselect', this.hide.bind(this));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (Shopify.designMode) {
      document.body.classList.remove(this.classes.open);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'open':
        this.controls.forEach((button) => button.setAttribute('aria-expanded', newValue === null ? 'false' : 'true'));

        if (oldValue === null && (newValue === "" || newValue === 'immediate')) {
          this.hidden = false;
          this.removeAttribute('inert');

          this.originalParentBeforeAppend = null;
          if (this.shouldAppendToBody && this.parentElement !== document.body) {
            this.originalParentBeforeAppend = this.parentElement;
            document.body.append(this);
          }
          const showTransitionPromise = this.showTransition(newValue !== 'immediate') || Promise.resolve();
          showTransitionPromise.then(() => {
            this.afterShow();
            this.dispatchEvent(new CustomEvent(this.events.afterShow, { bubbles: true }));
          });
        }
        else if (oldValue !== null && newValue === null) {
          this.setAttribute('inert', '');

          const hideTransitionPromise = this.hideTransition() || Promise.resolve();
          hideTransitionPromise.then(() => {
            this.afterHide();

            if (!this.hasAttribute('inert')) return;

            if (this.parentElement === document.body && this.originalParentBeforeAppend) {
              this.originalParentBeforeAppend.appendChild(this);
              this.originalParentBeforeAppend = null;
            }
            this.dispatchEvent(new CustomEvent(this.events.afterHide, { bubbles: true }));

            this.hidden = true;
          });
        }
        this.dispatchEvent(new CustomEvent('toggle', { bubbles: true }));

        break;
    }
  }

  onButtonClick(event) {
    event.preventDefault();

    this.open ? this.hide() : this.show(event.currentTarget);
  }

  hide() {
    if (!this.open) return;

    this.beforeHide();
    this.resetGesture();
    this.removeAttribute('open');

    return theme.utils.waitForEvent(this, this.events.afterHide);
  }
  show(activeElement = null, animate = true) {
    if (this.open) return;

    if (this.shouldCloseAll) {
      document.dispatchEvent(new CustomEvent(this.events.closeAll), { bubbles: true });
    }

    this.beforeShow();
    this.activeElement = activeElement;
    this.setAttribute('open', animate ? '' : 'immediate');

    if (this.shouldLock) {
      document.body.classList.add(this.classes.opening);
    }

    return theme.utils.waitForEvent(this, this.events.afterShow);
  }

  beforeHide() { }
  beforeShow() { }

  afterHide() {
    setTimeout(() => {
      theme.a11y.removeTrapFocus(this.activeElement);
      if (this.shouldLock) {
        lockLayerCount.set(ModalElement, lockLayerCount.get(ModalElement) - 1);

        document.body.classList.toggle(this.classes.open, lockLayerCount.get(ModalElement) > 0);
      }
    });
  }
  afterShow() {
    theme.a11y.trapFocus(this, this.focusElement);
    if (this.shouldLock) {
      lockLayerCount.set(ModalElement, lockLayerCount.get(ModalElement) + 1);

      document.body.classList.remove(this.classes.opening);
      document.body.classList.add(this.classes.open);
    }
  }

  showTransition() {
    setTimeout(() => {
      this.setAttribute('active', '');
    }, 75);
    return new Promise((resolve) => {
      const computedStyle = window.getComputedStyle(this.overlay);
      const hasTransition = computedStyle.transitionProperty !== 'none' && parseFloat(computedStyle.transitionDuration) > 0;

      if (!hasTransition) {
        resolve();
        return;
      }

      this.overlay.addEventListener('transitionend', resolve, { once: true });
    });
  }
  hideTransition() {
    this.removeAttribute('active');
    return new Promise((resolve) => {
      const computedStyle = window.getComputedStyle(this.overlay);
      const hasTransition = computedStyle.transitionProperty !== 'none' && parseFloat(computedStyle.transitionDuration) > 0;

      if (!hasTransition) {
        resolve();
        return;
      }

      this.overlay.addEventListener('transitionend', resolve, { once: true });
    });
  }

  resetGesture() {
    if (this.gesture) {
      this.gestureWrap.style.transform = '';
      this.gestureWrap.style.transition = '';
      this.overlay.style.opacity = '';
      this.overlay.style.transition = '';
    }
  }

  onPanStart() {
    this.removeTransition(this.gestureWrap, 'transform');

    if (this.hasAttribute('open')) {
      if (this.gestureConfig.layerHeight === null) {
        this.gestureConfig.layerHeight = this.gestureWrap.getBoundingClientRect().height;
      }
      this.gestureConfig.maxGestureDistance = this.gestureConfig.layerHeight - 50;
      this.gestureConfig.endPoint = this.gestureConfig.layerHeight * 0.3;
    }
  }

  onPanMove() {
    if (this.gestureConfig.animationFrame) return;

    this.gestureConfig.animationFrame = requestAnimationFrame(() => {
      const clamp = (a, min = 0, max = 1) => Math.min(max, Math.max(min, a));
      const invlerp = (x, y, a) => clamp((a - x) / (y - x));

      // Give an indication of whether we've passed the swiping threshold.
      this.gestureWrap.style.transition = 'transform .1s linear';
      this.overlay.style.transition = 'opacity .1s linear';

      if (this.hasAttribute('open')) {
        if (this.gestureConfig.layerHeight === null) {
          this.gestureConfig.layerHeight = this.gestureWrap.getBoundingClientRect().height;
        }

        this.gestureConfig.moveY = this.gesture.touchMoveY;
        this.gestureConfig.maxGestureDistance = this.gestureConfig.layerHeight - 50;

        if (this.gestureConfig.moveY >= 0) {
          this.gestureWrap.style.transform = `translateY(${Math.min(
            this.gestureConfig.moveY,
            this.gestureConfig.maxGestureDistance
          )}px)`;

          this.overlay.style.opacity = invlerp(this.gestureConfig.layerHeight, 0, this.gestureConfig.moveY);
        }
        else {
          this.gestureWrap.style.transform = 'translateY(0)';
          this.gestureWrap.style.transition = '';
          this.overlay.style.opacity = '1';
        }
      }

      this.gestureConfig.animationFrame = null;
    });
  }

  onPanEnd() {
    this.gestureConfig.animationFrame === null || cancelAnimationFrame(this.gestureConfig.animationFrame);
    this.gestureConfig.animationFrame = null;
    this.gestureWrap.style.transition = 'transform .1s linear';

    if (this.gestureConfig.layerHeight === null) {
      this.gestureConfig.layerHeight = this.gestureWrap.getBoundingClientRect().height;
    }

    this.gestureConfig.endPoint = this.gestureConfig.layerHeight * 0.3;

    if (this.hasAttribute('open')) {
      this.gestureConfig.moveY = this.gesture.touchMoveY;

      if (this.gestureConfig.moveY < this.gestureConfig.endPoint) {
        this.gestureWrap.style.transform = 'translateY(0)';
      }
      else {
        this.gestureWrap.style.transform = `translateY(${this.gestureConfig.layerHeight}px)`;

        this.gestureWrap.addEventListener(
          this.whichTransitionEvent(),
          () => {
            this.hide();
          },
          { once: true }
        );
      }
    }
  }

  removeTransition(node, transition) {
    const match = node.style.transition.match(new RegExp('(?:^|,)\\s*' + transition + '(?:$|\\s|,)[^,]*', 'i'));
    if (match) {
      const transitionArray = node.style.transition.split('');
      transitionArray.splice(match.index, match[0].length);
      node.style.transition = transitionArray.join('');
    }
  }

  whichTransitionEvent() {
    let t;
    const el = document.createElement('fakeelement');
    const transitions = {
      WebkitTransition: 'webkitTransitionEnd',
      MozTransition: 'transitionend',
      MSTransition: 'msTransitionEnd',
      OTransition: 'oTransitionEnd',
      transition: 'transitionEnd',
    };

    for (t in transitions) {
      if (el.style[t] !== undefined) {
        return transitions[t];
      }
    }
  }
}
customElements.define('modal-element', ModalElement);
lockLayerCount.set(ModalElement, 0);

class DrawerElement extends ModalElement {
  constructor() {
    super();

    this.events = {
      afterHide: 'drawer:afterHide',
      afterShow: 'drawer:afterShow'
    };
  }

  get shouldLock() {
    return true;
  }

  get shouldAppendToBody() {
    return true;
  }
}
customElements.define('drawer-element', DrawerElement);

class MenuDrawer extends DrawerElement {

  get menuItems() {
    return this._menuItems = this._menuItems || this.querySelectorAll('.drawer__menu:not(.active)>li');
  }

  beforeShow() {
    super.beforeShow();
    setTimeout(() => {
      Motion.animate(this.menuItems, { transform: ['translateX(-20px)', 'translateX(0)'], opacity: [0, 1] }, { duration: 0.6, easing: [.075, .82, .165, 1], delay: Motion.stagger(0.1) }).finished.then(() => {
        this.menuItems.forEach((item) => item.removeAttribute('style'));
      });
    }, 300);
  }

  beforeHide() {
    super.beforeHide();

    setTimeout(() => {
      this.querySelectorAll('details[is=menu-details]').forEach((subMenu) => {
        subMenu.onCloseButtonClick();
      });
    }, 300);
  }
}
customElements.define('menu-drawer', MenuDrawer);

class ShareDrawer extends DrawerElement {

  get menuItems() {
    return this._menuItems = this._menuItems || this.querySelectorAll('.share-buttons>li');
  }

  get urlToShare() {
    const urlInput = this.querySelector('input[type=hidden]');
    return urlInput ? urlInput.value : document.location.href;
  }

  connectedCallback() {
    if (navigator.share) {
      // Skip modal setup: Web Share handles sharing directly.
      // this.on() lazily creates eventsController; disconnect aborts it.
      this.controls.forEach((button) => this.on(button, 'click', this.shareTo.bind(this)));
    }
    else {
      super.connectedCallback();
    }
  }

  async shareTo(event) {
    event.preventDefault();
    try {
      await navigator.share({ url: this.urlToShare, title: document.title });
    }
    catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    }
  }

  beforeShow() {
    super.beforeShow();
    setTimeout(() => {
      Motion.animate(this.menuItems, { transform: ['translateY(2.5rem)', 'translateY(0)'], opacity: [0, 1] }, { duration: 0.6, easing: [.075, .82, .165, 1], delay: Motion.stagger(0.1) }).finished.then(() => {
        this.menuItems.forEach((item) => item.removeAttribute('style'));
      });
    }, 300);
  }
}
customElements.define('share-drawer', ShareDrawer);

class BackInStockDrawer extends DrawerElement {
  constructor() {
    super();

    if (!theme.config.isTouch || Shopify.designMode) {
      this.init();
    }
    else {
      new theme.initWhenVisible(this.init.bind(this));
    }
  }

  get submited() {
    return this.querySelector('.alert') !== null;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Open modal if errors or success message exist
    if (this.submited) {
      setTimeout(() => {
        this.show();
      }, 1000);
    }
  }
}
customElements.define('back-in-stock-drawer', BackInStockDrawer);

class MenuDetails extends BaseElementMixin(HTMLDetailsElement) {
  connectedCallback() {
    super.connectedCallback();

    this.on(this.summary, 'click', this.onSummaryClick.bind(this));
    this.on(this.closeButton, 'click', this.onCloseButtonClick.bind(this));
  }

  get parent() {
    return this.closest('[data-parent]');
  }

  get summary() {
    return this.querySelector('summary');
  }

  get closeButton() {
    return this.querySelector('[data-close]');
  }

  get focusElement() {
    return this.summary.nextElementSibling.querySelector('button');
  }

  onSummaryClick(event) {
    event.preventDefault();
    this.setAttribute('open', '');
    this.activeElement = event.currentTarget;

    setTimeout(() => {
      this.parent.classList.add('active');
      this.classList.add('active');
      this.summary.setAttribute('aria-expanded', true);
      this.summary.setAttribute('tabindex', '-1');

      setTimeout(() => {
        theme.a11y.trapFocus(this, this.focusElement);
      }, 100);
    }, 100);
  }

  onCloseButtonClick() {
    this.parent.classList.remove('active');
    this.classList.remove('active');
    this.summary.setAttribute('aria-expanded', false);
    this.summary.removeAttribute('tabindex');

    this.closeAnimation();
  }

  closeAnimation() {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        requestAnimationFrame(handleAnimation);
      }
      else {
        this.removeAttribute('open');
        theme.a11y.removeTrapFocus(this.activeElement);
      }
    }

    requestAnimationFrame(handleAnimation);
  }
}
customElements.define('menu-details', MenuDetails, { extends: 'details' });

class QuantityLabel extends HTMLLabelElement {

  connectedCallback() {
    this.querySelector('.quantity__rules-cart').append(this.animationElement);
  }

  static get observedAttributes() {
    return ['aria-busy'];
  }

  get contentElement() {
    return this._contentElement = this._contentElement || this.querySelector('.quantity-cart');
  }

  get animationElement() {
    return this._animationElement = this._animationElement || document.createRange().createContextualFragment(`
      <span class="btn-loader">
        <span></span>
        <span></span>
        <span></span>
      </span>
    `).firstElementChild;
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if (newValue === 'true') {
      Motion.timeline([
        [this.contentElement, { opacity: 0 }, { duration: 0.15 }],
        [this.animationElement, { opacity: 1 }, { duration: 0.15 }]
      ]);
      this.loaderAnimation = Motion.animate(this.animationElement.children, { transform: ['scale(1.6)', 'scale(0.6)'] }, { duration: 0.35, delay: Motion.stagger(0.35 / 2), direction: 'alternate', repeat: Infinity });
    }
    else {
      this.loaderAnimation?.stop();
      this.loaderAnimation = null;
      Motion.timeline([
        [this.animationElement, { opacity: 0 }, { duration: 0.15 }],
        [this.contentElement, { opacity: 1 }, { duration: 0.15 }]
      ]);
    }
  }
}
customElements.define('quantity-label', QuantityLabel, { extends: 'label' });

class QuantityInput extends BaseElement {

  get sectionId() {
    return this.getAttribute('data-section-id');
  }

  get productId() {
    return this.getAttribute('data-product-id');
  }

  get input() {
    return this.querySelector('input');
  }

  get value() {
    return this.input.value;
  }

  connectedCallback() {
    super.connectedCallback();

    this.buttons = Array.from(this.querySelectorAll('button'));
    this.changeEvent = new Event('change', { bubbles: true });
    this.on(this.input, 'change', this.onInputChange.bind(this));
    this.on(this.input, 'focus', () => setTimeout(() => this.input.select()));

    this.buttons.forEach((button) => this.on(button, 'click', this.onButtonClick.bind(this)));

    this.validateQtyRules();
    const quantityUpdateUnsubscriber = theme.pubsub.subscribe(theme.pubsub.PUB_SUB_EVENTS.quantityUpdate, this.validateQtyRules.bind(this));
    this.registerCleanup(quantityUpdateUnsubscriber);

    const quantityBoundriesUnsubscriber = theme.pubsub.subscribe(theme.pubsub.PUB_SUB_EVENTS.quantityBoundries, this.setQuantityBoundries.bind(this));
    this.registerCleanup(quantityBoundriesUnsubscriber);

    const quantityRulesUnsubscriber = theme.pubsub.subscribe(theme.pubsub.PUB_SUB_EVENTS.quantityRules, this.updateQuantityRules.bind(this));
    this.registerCleanup(quantityRulesUnsubscriber);
  }

  onButtonClick(event) {
    event.preventDefault();
    if (this.input.disabled) return;
    const previousValue = this.input.value;

    if (event.currentTarget.name === 'plus') {
      if (parseInt(this.input.getAttribute('data-min')) > parseInt(this.input.step) && this.input.value == 0) {
        this.input.value = this.input.getAttribute('data-min');
      }
      else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);

    if (this.input.getAttribute('data-min') === previousValue && event.currentTarget.name === 'minus') {
      this.input.value = parseInt(this.input.min);
    }
  }

  onInputChange() {
    if (this.input.value === '') {
      this.input.value = parseInt(this.input.min);
    }
    this.validateQtyRules();
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const buttonMinus = this.querySelector('button[name="minus"]');
      if (buttonMinus) buttonMinus.toggleAttribute('disabled', parseInt(value) <= parseInt(this.input.min));
    }
    if (this.input.max) {
      const buttonPlus = this.querySelector('button[name="plus"]');
      if (buttonPlus) buttonPlus.toggleAttribute('disabled', parseInt(value) >= parseInt(this.input.max));
    }
  }

  updateQuantityRules({ data: { sectionId, productId, parsedHTML } }) {
    if (sectionId !== this.sectionId || productId !== this.productId) return;

    const selectors = ['.quantity__input', '.quantity__rules', '.quantity__label'];
    const quantityFormUpdated = parsedHTML.getElementById(`QuantityForm-${sectionId}-${this.productId}`);
    const quantityForm = this.closest(`#QuantityForm-${sectionId}-${this.productId}`);
    for (let selector of selectors) {
      const current = quantityForm.querySelector(selector);
      const updated = quantityFormUpdated.querySelector(selector);
      if (!current || !updated) continue;

      if (selector === '.quantity__input') {
        const attributes = ['data-cart-quantity', 'data-min', 'data-max', 'step'];
        for (let attribute of attributes) {
          const valueUpdated = updated.getAttribute(attribute);
          if (valueUpdated !== null) {
            current.setAttribute(attribute, valueUpdated);
          }
          else {
            current.removeAttribute(attribute);
          }
        }
      }
      else {
        current.innerHTML = updated.innerHTML;
      }
    }
  }

  setQuantityBoundries({ data: { sectionId, productId } }) {
    if (sectionId !== this.sectionId || productId !== this.productId) return;

    const data = {
      cartQuantity: this.input.hasAttribute('data-cart-quantity') ? parseInt(this.input.getAttribute('data-cart-quantity')) : 0,
      min: this.input.hasAttribute('data-min') ? parseInt(this.input.getAttribute('data-min')) : 1,
      max: this.input.hasAttribute('data-max') ? parseInt(this.input.getAttribute('data-max')) : null,
      step: this.input.hasAttribute('step') ? parseInt(this.input.getAttribute('step')) : 1
    };

    let min = data.min;
    const max = data.max === null ? data.max : data.max - data.cartQuantity;
    if (max !== null) min = Math.min(min, max);
    if (data.cartQuantity >= data.min) min = Math.min(min, data.step);

    this.input.min = min;

    if (max) {
      this.input.max = max;
    }
    else {
      this.input.removeAttribute('max');
    }
    this.input.value = min;

    theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.quantityUpdate, undefined);
  }

  reset() {
    this.input.value = this.input.defaultValue;
  }
}
customElements.define('quantity-input', QuantityInput);

class CartCount extends BaseElement {

  connectedCallback() {
    super.connectedCallback();

    const cartUpdateUnsubscriber = theme.pubsub.subscribe(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, this.onCartUpdate.bind(this));
    this.registerCleanup(cartUpdateUnsubscriber);
  }

  get itemCount() {
    return parseInt(this.innerText);
  }

  onCartUpdate(event) {
    if (event.cart.errors) return;

    this.innerText = event.cart.item_count;
    this.hidden = this.itemCount === 0;
  }
}
customElements.define('cart-count', CartCount);

class RecentlyViewed extends HTMLElement {
  constructor() {
    super();

    if (!theme.config.hasLocalStorage) {
      this.hidden = true;
      return;
    }

    Motion.inView(this, this.init.bind(this), { margin: '600px 0px 600px 0px' });
  }

  init() {
    fetch(this.getAttribute('data-url') + this.getQueryString())
      .then(response => response.text())
      .then(responseText => {
        const sectionInnerHTML = new DOMParser()
          .parseFromString(responseText, 'text/html')
          .querySelector('.shopify-section');

        const recommendations = sectionInnerHTML.querySelector('recently-viewed');
        if (recommendations && recommendations.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
          this.dispatchEvent(new CustomEvent('recentlyViewed:loaded'));
        }
        else {
          this.closest('.recently-section')?.remove();
          this.dispatchEvent(new CustomEvent('is-empty'));
        }
      })
      .catch(e => {
        console.error(e);
      });
  }

  getQueryString() {
    let recentlyViewed = '[]';
    if (theme.config.hasLocalStorage) {
      recentlyViewed = window.localStorage.getItem(`${theme.settings.themeName}:recently-viewed`) || '[]';
    }

    const items = new Set(JSON.parse(recentlyViewed));
    if (this.hasAttribute('data-product-id')) {
      items.delete(parseInt(this.getAttribute('data-product-id')));
    }
    return Array.from(items.values(), (item) => `id:${item}`).slice(0, this.hasAttribute('data-limit') ? parseInt(this.getAttribute('data-limit')) : 4).join(' OR ');
  }
}
customElements.define('recently-viewed', RecentlyViewed);

class ProductRecommendations extends HTMLElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this), { margin: '600px 0px 600px 0px' });
  }

  init() {
    fetch(this.getAttribute('data-url'))
      .then(response => response.text())
      .then(responseText => {
        const sectionInnerHTML = new DOMParser()
          .parseFromString(responseText, 'text/html')
          .querySelector('.shopify-section');

        if (sectionInnerHTML === null) return;

        const recommendations = sectionInnerHTML.querySelector('product-recommendations');
        if (recommendations && recommendations.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
          this.dispatchEvent(new CustomEvent('recommendations:loaded'));
        }
        else {
          this.setAttribute('hidden', '');
          this.closest('.recommendations-section')?.remove();
          this.dispatchEvent(new CustomEvent('is-empty'));
        }
      })
      .catch(e => {
        console.error(e);
      });
  }
}
customElements.define('product-recommendations', ProductRecommendations);

class ProductComplementary extends HTMLElement {
  constructor() {
    super();

    this.selectedIndex = this.selectedIndex;
  }

  static get observedAttributes() {
    return ['selected-index'];
  }

  get selectedIndex() {
    return parseInt(this.getAttribute('selected-index')) || 0;
  }

  set selectedIndex(index) {
    this.setAttribute('selected-index', Math.min(Math.max(index, 0), this.items.length - 1).toString());
  }

  get items() {
    return this._items = this._items || Array.from(this.children);
  }

  get container() {
    return this.closest('product-recommendations');
  }

  get prevButton() {
    return this.container.querySelector('[data-prev-button]');
  }

  get nextButton() {
    return this.container.querySelector('[data-next-button]');
  }

  connectedCallback() {
    if (this.innerHTML.trim().length) {
      if (this.classList.contains('flickity')) {
        this.carousel = new theme.Carousel(this, {
          accessibility: false,
          prevNextButtons: false,
          adaptiveHeight: true,
          pageDots: false,
          contain: true,
          cellAlign: 'center',
          rightToLeft: theme.config.rtl,
        }, {
          previous: this.prevButton,
          next: this.nextButton
        });

        this.carousel.load();
        this.carousel.slider.on('change', this.onChange.bind(this));
      }
    }
    else {
      this.container.hidden = true;
    }
  }

  disconnectedCallback() {
    if (this.carousel) {
      this.carousel.unload();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'selected-index' && oldValue !== null && oldValue !== newValue) {
      const focusableEvents = 'button, [href]';

      const fromElement = this.items[parseInt(oldValue)];
      const toElement = this.items[parseInt(newValue)];

      fromElement.querySelectorAll(focusableEvents).forEach((el) => {
        el.setAttribute('tabindex', '-1');
      });
      toElement.querySelectorAll(focusableEvents).forEach((el) => {
        el.removeAttribute('tabindex');
      });
    }
  }

  onChange() {
    this.selectedIndex = this.carousel.slider.selectedIndex;
  }
}
customElements.define('product-complementary', ProductComplementary);

class MediaElement extends BaseElement {

  get parallax() {
    return this.hasAttribute('data-parallax') ? parseFloat(this.getAttribute('data-parallax')) : false;
  }

  get direction() {
    return this.hasAttribute('data-parallax-dir') ? this.getAttribute('data-parallax-dir') : 'vertical';
  }

  get media() {
    return Array.from(this.querySelectorAll('picture>img, video, iframe, svg, video-media, g-map'));
  }

  connectedCallback() {
    super.connectedCallback();

    if (theme.config.motionReduced || !this.parallax) return;
    this.setupParallax();
  }

  setupParallax() {
    const [scale, translate] = [1 + this.parallax, this.parallax * 100 / (1 + this.parallax)];

    if (this.direction === 'vertical') {
      const cancelParallax = Motion.scroll(
        Motion.animate(this.media, { transform: [`scale(${scale}) translateY(0)`, `scale(${scale}) translateY(${translate}%)`], transformOrigin: ['bottom', 'bottom'] }, { easing: 'linear' }),
        { target: this, offset: ['start end', 'end start'] }
      );
      this.registerCleanup(cancelParallax);
    }
    else if (this.direction === 'horizontal') {
      const cancelParallax = Motion.scroll(
        Motion.animate(this.media, { transform: [`scale(${scale}) translateX(0)`, `scale(${scale}) translateX(${translate}%)`], transformOrigin: ['right', 'right'] }, { easing: 'linear' }),
        { target: this, offset: ['start end', 'end start'] }
      );
      this.registerCleanup(cancelParallax);
    }
    else {
      const cancelParallax = Motion.scroll(
        Motion.animate(this.media, { transform: [`scale(1)`, `scale(${scale})`], transformOrigin: ['center', 'center'] }, { easing: 'linear' }),
        { target: this, offset: ['start end', 'end start'] }
      );
      this.registerCleanup(cancelParallax);
    }
  }
}
customElements.define('media-element', MediaElement);

class SplitWords extends HTMLElement {
  constructor() {
    super();

    this.loadPromise = new Promise((resolve) => {
      this.resolveLoad = resolve;
    });
  }

  connectedCallback() {
    if (theme.config.motionReduced) {
      this.resolveLoad();
      return;
    }
    if (!document.body.hasAttribute('data-title-animation')) return;

    this.init();
  }

  async init() {
    const splitting = Splitting({ target: this, by: 'words' });

    splitting[0].words.forEach((item, index) => {
      const wrapper = document.createElement('animate-element');
      wrapper.className = 'block';
      wrapper.setAttribute('data-animate', this.getAttribute('data-animate'));
      wrapper.setAttribute('data-animate-delay', (this.hasAttribute('data-animate-delay') ? parseInt(this.getAttribute('data-animate-delay')) : 0) + (index * 30));

      for (const itemContent of item.childNodes) {
        wrapper.appendChild(itemContent);
      }

      item.appendChild(wrapper);
    });
    this.classList.remove('js-invisible');

    const animateElements = this.querySelectorAll('animate-element');
    await Promise.all([...animateElements].map(el => el.loadPromise));
    this.resolveLoad();
  }
}
customElements.define('split-words', SplitWords);

class HighlightedText extends HTMLElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this));
  }

  get splitWords() {
    return this.closest('split-words');
  }

  async init() {
    if (this.splitWords) {
      await this.splitWords.loadPromise;
    }
    this.classList.add('animated');
  }
}
customElements.define('highlighted-text', HighlightedText, { extends: 'em' });

class MarqueeElement extends BaseElement {
  constructor() {
    super();

    if (theme.config.motionReduced) return;

    if (!theme.config.isTouch || Shopify.designMode) {
      Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
    }
    else {
      new theme.initWhenVisible(this.init.bind(this));
    }
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  get childElement() {
    return this.firstElementChild;
  }

  get speed() {
    return this.hasAttribute('data-speed') ? parseInt(this.getAttribute('data-speed')) : 16;
  }

  get maximum() {
    return this.hasAttribute('data-maximum') ? parseInt(this.getAttribute('data-maximum')) : (this.childElementWidth > 0 ? Math.ceil(this.parentWidth / this.childElementWidth) + 2 : 0);
  }

  get direction() {
    return this.hasAttribute('data-direction') ? this.getAttribute('data-direction') : 'left';
  }

  get parallax() {
    return !theme.config.isTouch && this.hasAttribute('data-parallax') ? parseFloat(this.getAttribute('data-parallax')) : false;
  }

  get parentWidth() {
    return this.getWidth(this);
  }

  get childElementWidth() {
    return this.getWidth(this.childElement);
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (this.childElementCount === 1) {
      this.childElement.classList.add('animated');

      const maximum = this.maximum;
      for (let index = 0; index < maximum; index++) {
        this.clone = this.childElement.cloneNode(true);
        this.clone.setAttribute('aria-hidden', 'true');
        this.clone.querySelectorAll('button, [href]').forEach((el) => {
          el.setAttribute('tabindex', '-1');
        });
        this.appendChild(this.clone);
        this.clone.querySelectorAll('.media').forEach((media) => media.classList.remove('loading'));
      }

      this.style.setProperty('--duration', `${(33 - this.speed) * Math.min(2.5, Math.ceil(this.childElementWidth / this.parentWidth))}s`);
    }

    if (this.parallax) {
      let translate = this.parallax * 100 / (1 + this.parallax);
      if (this.direction === 'right') {
        translate = translate * -1;
      }
      if (theme.config.rtl) {
        translate = translate * -1;
      }

      const cancelParallax = Motion.scroll(
        Motion.animate(this, { transform: [`translateX(${translate}%)`, `translateX(0)`] }, { easing: 'linear' }),
        { target: this, offset: ['start end', 'end start'] }
      );
      this.registerCleanup(cancelParallax);
    }
    else {
      // pause when out of view
      const observer = new IntersectionObserver((entries, _observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.classList.remove('paused');
          }
          else {
            this.classList.add('paused');
          }
        });
      }, { rootMargin: '0px 0px 50px 0px' });
      observer.observe(this);
      this.registerCleanup(() => observer.disconnect());
    }
  }

  getWidth(element) {
    const rect = element.getBoundingClientRect();
    return rect.right - rect.left;
  }
}
customElements.define('marquee-element', MarqueeElement);

class ScrolledImages extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
  }

  get parallax() {
    return this.hasAttribute('data-parallax') ? parseFloat(this.getAttribute('data-parallax')) : false;
  }

  get template() {
    return this.querySelector('template');
  }

  get images() {
    return Array.from(this.template.content.querySelectorAll('.scrolled-images__item'));
  }

  init() {
    this.beforeInit();

    if (theme.config.motionReduced || !this.parallax) return;
    this.setupParallax();
  }

  beforeInit() {
    const main = this.querySelector('.scrolled-images__main');

    for (let i = 0; i < 3; i++) {
      let images = this.shuffle(this.images);

      if (images.length < 8) {
        let start = 0;
        while (images.length < 8) {
          images.push(images[start].cloneNode(true));
          start++;
        }
      }

      const row = document.createElement('div');
      row.classList = 'scrolled-images__row';
      images.forEach((item) => row.appendChild(item.cloneNode(true)));

      main.appendChild(row);
    }
  }

  setupParallax() {
    Array.from(this.querySelectorAll('.scrolled-images__row')).forEach((element, index) => {
      let translate = -1 * this.parallax * 100 / (1 + this.parallax);
      if (theme.config.rtl) {
        translate = translate * -1;
      }

      if (index % 2 === 0) {
        const cancelParallax = Motion.scroll(
          Motion.animate(element, { transform: [`translateX(${translate}%)`, 'translateX(0)'] }, { easing: 'linear' }),
          { target: this, offset: Motion.ScrollOffset.Any }
        );
        this.registerCleanup(cancelParallax);
      }
      else {
        const cancelParallax = Motion.scroll(
          Motion.animate(element, { transform: ['translateX(0)', `translateX(${translate}%)`] }, { easing: 'linear' }),
          { target: this, offset: Motion.ScrollOffset.Any }
        );
        this.registerCleanup(cancelParallax);
      }
    });
  }

  shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
  }
}
customElements.define('scrolled-images', ScrolledImages);

class DropdownElement extends BaseElement {
  constructor() {
    super();

    this.classes = {
      bodyClass: 'has-dropdown'
    };

    this.events = {
      afterHide: 'dropdown:afterHide',
      afterShow: 'dropdown:afterShow'
    };

    this.detectHoverListener = this.detectHover.bind(this);
    this.controls.forEach((button) => {
      this.on(button, 'click', this.onToggleClicked.bind(this));
      this.on(button, 'mouseenter', this.detectHoverListener);
      this.on(button, 'mouseleave', this.detectHoverListener);
    });

    this.detectClickOutsideListener = this.detectClickOutside.bind(this);
    this.detectEscKeyboardListener = this.detectEscKeyboard.bind(this);
    this.detectFocusOutListener = this.detectFocusOut.bind(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Safety net if the element is removed while open (hide() would otherwise not run).
    document.removeEventListener('click', this.detectClickOutsideListener);
    document.removeEventListener('keyup', this.detectEscKeyboardListener);
    document.removeEventListener('focusout', this.detectFocusOutListener);
    document.body.classList.remove(this.classes.bodyClass);
  }

  static get observedAttributes() {
    return ["id", 'open'];
  }

  get open() {
    return this.hasAttribute('open');
  }

  get controls() {
    return Array.from(document.querySelectorAll(`[aria-controls="${this.id}"]`));
  }

  get container() {
    return this.querySelector('*:first-child');
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'open':
        this.controls.forEach((button) => button.setAttribute('aria-expanded', newValue === null ? 'false' : 'true'));
        break;
    }
  }

  show() {
    document.body.classList.add(this.classes.bodyClass);
    this.setAttribute('open', '');

    document.addEventListener('click', this.detectClickOutsideListener);
    document.addEventListener('keyup', this.detectEscKeyboardListener);
    document.addEventListener('focusout', this.detectFocusOutListener);

    this.afterShow();

    return theme.utils.waitForEvent(this, this.events.afterShow);
  }

  hide() {
    document.body.classList.remove(this.classes.bodyClass);
    this.removeAttribute('open');

    document.removeEventListener('click', this.detectClickOutsideListener);
    document.removeEventListener('keyup', this.detectEscKeyboardListener);
    document.removeEventListener('focusout', this.detectFocusOutListener);

    this.afterHide();

    return theme.utils.waitForEvent(this, this.events.afterHide);
  }

  onToggleClicked(event) {
    event?.preventDefault();
    this.open ? this.hide() : this.show();
  }

  afterShow() {
    Motion.animate(this, { opacity: [0, 1], visibility: 'visible' }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1] });
    Motion.animate(this.container, { transform: ['translateY(-105%)', 'translateY(0)'] }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1] });
  }

  afterHide() {
    Motion.animate(this, { opacity: 0, visibility: 'hidden' }, { duration: theme.config.motionReduced ? 0 : 0.3, easing: [.7, 0, .2, 1] });
    Motion.animate(this.container, { transform: 'translateY(-105%)' }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1] });
  }

  detectClickOutside(event) {
    if (!this.parentElement.contains(event.target)) {
      this.hide();
    }
  }

  detectEscKeyboard(event) {
    if (event.code === 'Escape') {
      this.hide();
    }
  }

  detectFocusOut(event) {
    if (event.relatedTarget && !this.contains(event.relatedTarget)) {
      this.hide();
    }
  }

  detectHover(event) {
    if (theme.config.isTouch) return;

    if (event.type === 'mouseenter') {
      this.show();
    }
    else {
      this.hide();
    }
  }
}
customElements.define('dropdown-element', DropdownElement);

class DropdownLocalization extends DropdownElement {
  afterShow() {
    Motion.animate(this, { opacity: [0, 1], visibility: 'visible' }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1] });
  }

  afterHide() {
    Motion.animate(this, { opacity: 0, visibility: 'hidden' }, { duration: theme.config.motionReduced ? 0 : 0.3, easing: [.7, 0, .2, 1] });
  }
}
customElements.define('dropdown-localization', DropdownLocalization);

const lockDropdownCount = new WeakMap();
class DetailsDropdown extends BaseElementMixin(HTMLDetailsElement) {
  constructor() {
    super();

    this.classes = {
      bodyClass: 'has-dropdown-menu'
    };

    this.events = {
      afterHide: 'menu:afterHide',
      afterShow: 'menu:afterShow'
    };

    this._open = this.hasAttribute('open');

    this.detectClickOutsideListener = this.detectClickOutside.bind(this);
    this.detectEscKeyboardListener = this.detectEscKeyboard.bind(this);
    this.detectFocusOutListener = this.detectFocusOut.bind(this);

    this.hoverTimer = null;
    this.detectHoverListener = this.detectHover.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this.summaryElement, 'click', this.onSummaryClicked.bind(this));
    this.on(this, 'mouseenter', this.detectHoverListener);
    this.on(this, 'mouseleave', this.detectHoverListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (!this._open) return;

    // Removed while open: transition(false) never ran, so undo its global side-effects.
    document.removeEventListener('click', this.detectClickOutsideListener);
    document.removeEventListener('keyup', this.detectEscKeyboardListener);
    document.removeEventListener('focusout', this.detectFocusOutListener);

    lockDropdownCount.set(DetailsDropdown, lockDropdownCount.get(DetailsDropdown) - 1);
    document.body.classList.toggle(this.classes.bodyClass, lockDropdownCount.get(DetailsDropdown) > 0);
  }

  set open(value) {
    if (value !== this._open) {
      this._open = value;

      if (this.isConnected) {
        this.transition(value);
      }
      else {
        value ? this.setAttribute('open', '') : this.removeAttribute('open');
        this.updateAriaExpanded(value);
      }
    }
  }

  get summaryElement() {
    return this.firstElementChild;
  }

  get contentElement() {
    return this.lastElementChild;
  }

  get open() {
    return this._open;
  }

  get trigger() {
    return this.hasAttribute('trigger') ? this.getAttribute('trigger') : 'click';
  }

  get level() {
    return this.hasAttribute('level') ? this.getAttribute('level') : 'top';
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  onSummaryClicked(event) {
    event.preventDefault();

    if (!theme.config.isTouch && this.trigger === 'hover' && this.summaryElement.hasAttribute('data-link') && this.summaryElement.getAttribute('data-link').length > 0) {
      window.location.href = this.summaryElement.getAttribute('data-link');
    }
    else {
      this.open = !this.open;
    }
  }

  async transition(value) {
    this.updateAriaExpanded(value);

    if (value) {
      lockDropdownCount.set(DetailsDropdown, lockDropdownCount.get(DetailsDropdown) + 1);
      document.body.classList.add(this.classes.bodyClass);

      this.setAttribute('open', '');
      this.summaryElement.setAttribute('open', '');
      if (theme.config.motionReduced) {
        this.contentElement.setAttribute('open', '');
      } else {
        setTimeout(() => this.contentElement.setAttribute('open', ''), 100);
      }
      document.addEventListener('click', this.detectClickOutsideListener);
      document.addEventListener('keyup', this.detectEscKeyboardListener);
      document.addEventListener('focusout', this.detectFocusOutListener);
      await this.transitionIn();
      this.shouldReverse();

      return theme.utils.waitForEvent(this, this.events.afterShow);
    }
    else {
      lockDropdownCount.set(DetailsDropdown, lockDropdownCount.get(DetailsDropdown) - 1);
      document.body.classList.toggle(this.classes.bodyClass, lockDropdownCount.get(DetailsDropdown) > 0);

      this.summaryElement.removeAttribute('open');
      this.contentElement.removeAttribute('open');
      document.removeEventListener('click', this.detectClickOutsideListener);
      document.removeEventListener('keyup', this.detectEscKeyboardListener);
      document.removeEventListener('focusout', this.detectFocusOutListener);
      await this.transitionOut();
      if (!this.open) this.removeAttribute('open');

      return theme.utils.waitForEvent(this, this.events.afterHide);
    }
  }

  async transitionIn() {
    Motion.animate(this.contentElement, { opacity: [0, 1], visibility: 'visible' }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1], delay: theme.config.motionReduced ? 0 : 0.2 });
    const translateY = this.level === 'top' ? '-105%' : '2rem';
    return Motion.animate(this.contentElement.firstElementChild, { transform: [`translateY(${translateY})`, 'translateY(0)'] }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1] }).finished;
  }

  async transitionOut() {
    Motion.animate(this.contentElement, { opacity: 0, visibility: 'hidden' }, { duration: theme.config.motionReduced ? 0 : 0.3, easing: [.7, 0, .2, 1] });
    const translateY = this.level === 'top' ? '-105%' : '2rem';
    return Motion.animate(this.contentElement.firstElementChild, { transform: `translateY(${translateY})` }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1] }).finished;
  }

  detectClickOutside(event) {
    if (!this.contains(event.target) && !(event.target.closest('details') instanceof DetailsDropdown)) {
      this.open = false;
    }
  }

  detectEscKeyboard(event) {
    if (event.code === 'Escape') {
      const targetMenu = event.target.closest('details[open]');
      if (targetMenu) {
        targetMenu.open = false;
      }
    }
  }

  detectFocusOut(event) {
    if (event.relatedTarget && !this.contains(event.relatedTarget)) {
      this.open = false;
    }
  }

  detectHover(event) {
    if (this.trigger !== 'hover' || theme.config.isTouch) return;

    if (event.type === 'mouseenter') {
      this.open = true;
    }
    else {
      this.open = false;
    }
  }

  shouldReverse() {
    const maxWidth = this.contentElement.offsetLeft + this.contentElement.clientWidth * 2;
    if (maxWidth > window.innerWidth) {
      this.contentElement.classList.add('should-reverse');
    }
  }

  updateAriaExpanded(isOpen) {
    this.summaryElement.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
}
customElements.define('details-dropdown', DetailsDropdown, { extends: 'details' });
lockDropdownCount.set(DetailsDropdown, 0);

class DetailsMega extends DetailsDropdown {
  connectedCallback() {
    super.connectedCallback();

    if (Shopify.designMode) {
      this.on(this, 'shopify:block:select', () => this.open = true);
      this.on(this, 'shopify:block:deselect', () => this.open = false);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this._open) document.body.classList.remove('with-mega');
  }

  async transitionIn() {
    this.contentElement.querySelector('tabs-element')?.unload();
    setTimeout(() => {
      this.contentElement.querySelector('tabs-element')?.load();
    }, theme.config.motionReduced ? 0 : 450);

    document.body.classList.add('with-mega');
    return Motion.animate(this.contentElement.firstElementChild, { visibility: 'visible', transform: ['translateY(-105%)', 'translateY(0)'] }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1] }).finished;
  }

  async transitionOut() {
    document.body.classList.remove('with-mega');
    return Motion.animate(this.contentElement.firstElementChild, { visibility: 'hidden', transform: 'translateY(-105%)' }, { duration: theme.config.motionReduced ? 0 : 0.6, easing: [.7, 0, .2, 1] }).finished;
  }
}
customElements.define('details-mega', DetailsMega, { extends: 'details' });

class LocalizationListbox extends BaseElementMixin(HTMLFormElement) {
  connectedCallback() {
    super.connectedCallback();

    this.items.forEach((item) => this.on(item, 'click', this.onItemClick.bind(this)));
  }

  get items() {
    return this._items = this._items || Array.from(this.querySelectorAll('a'));
  }

  get input() {
    return this.querySelector('input[name="locale_code"], input[name="country_code"]');
  }

  get returnTo() {
    return this.querySelector('input[name="return_to"]');
  }

  onItemClick(event) {
    event.preventDefault();

    this.input.value = event.currentTarget.getAttribute('data-value');
    this.returnTo.value = window.location.pathname;
    this.submit();
  }
}
customElements.define('localization-listbox', LocalizationListbox, { extends: 'form' });

class LocalizationForm extends BaseElementMixin(HTMLFormElement) {
  constructor() {
    super();

    if (!theme.config.isTouch || Shopify.designMode) {
      Motion.inView(this, this.init.bind(this));
    }
    else {
      new theme.initWhenVisible(this.init.bind(this));
    }
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.on(this, 'change', this.submit);
  }
}
customElements.define('localization-form', LocalizationForm, { extends: 'form' });

const cachedSectionsRenderingAPI = new Map();
class APIButton extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this));
  }

  get sectionId() {
    return this.getAttribute('data-section-id');
  }

  get sectionRenderingId() {
    return this.getAttribute('data-id');
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (document.getElementById(this.sectionRenderingId) === null || document.getElementById(this.sectionRenderingId).hasAttribute('loaded')) return;

    const url = `${theme.routes.root_url}?section_id=${this.sectionId}`;
    cachedSectionsRenderingAPI.has(url)
      ? this.renderSectionFromCache(url)
      : this.renderSectionFromFetch(url);

    this.sectionsRenderingAPIListener = this.afterSectionsRenderingAPI.bind(this);
    this.on(document, 'sectionsRenderingAPI:cached', this.sectionsRenderingAPIListener);
  }

  renderSectionFromCache(url) {
    const responseText = cachedSectionsRenderingAPI.get(url);
    if (responseText.length) {
      this.updateSectionRendering(responseText);
    }
  }

  renderSectionFromFetch(url) {
    cachedSectionsRenderingAPI.set(url, '');
    fetch(url)
      .then(response => response.text())
      .then(responseText => {
        this.updateSectionRendering(responseText);
        cachedSectionsRenderingAPI.set(url, responseText);

        document.dispatchEvent(new CustomEvent('sectionsRenderingAPI:cached', {
          detail: {
            url,
            sectionId: this.sectionId
          }
        }));
      })
      .catch(e => {
        console.error(e);
      });
  }

  updateSectionRendering(responseText) {
    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
    document.getElementById(this.sectionRenderingId).replaceWith(parsedHTML.getElementById(this.sectionRenderingId));

    // remove listener
    document.removeEventListener('sectionsRenderingAPI:cached', this.sectionsRenderingAPIListener);
  }

  afterSectionsRenderingAPI(event) {
    if (event.detail.sectionId === this.sectionId) {
      this.renderSectionFromCache(event.detail.url);
    }
  }
}
customElements.define('api-button', APIButton);

class StickyElement extends BaseElement {
  constructor() {
    super();

    this.endScroll = window.innerHeight - this.offsetHeight - 500;
    this.currPos = window.scrollY;
    this.screenHeight = window.innerHeight;
    this.stickyElementHeight = this.offsetHeight;
    this.bottomGap = this.offsetHeight < window.innerHeight ? this.topGap : 0;
    this.ticking = false;
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(window, 'scroll', this.onScrollHandler.bind(this), { capture: true, passive: true });
  }

  get headerHeight() {
    let header = document.querySelector('.header-section header[is="sticky-header"]');
    if (this.hasAttribute('aria-controls')) {
      header = document.getElementById(this.getAttribute('aria-controls'));
    }
    return header ? (header.getBoundingClientRect().height + this.topGap) : (this.offsetHeight < window.innerHeight ? this.topGap : 0);
  }

  get topGap() {
    return this.hasAttribute('data-gap') ? parseInt(this.getAttribute('data-gap')) : 20;
  }

  get inset() {
    return parseFloat(this.style.getPropertyValue('--inset')) || 0;
  }

  onScrollHandler() {
    if (!this.ticking) {
      requestAnimationFrame(() => {
        const style = window.getComputedStyle(this);
        if (style.position == 'sticky') {
          this.screenHeight = window.innerHeight;
          this.stickyElementHeight = this.offsetHeight;

          this.positionStickySidebar();
        }
        this.ticking = false;
      });
      this.ticking = true;
    }
  }

  positionStickySidebar() {
    this.endScroll = window.innerHeight - this.offsetHeight - this.bottomGap;
    const stickyElementTop = this.inset;
    const scrollDelta = this.currPos - window.scrollY;

    if (this.stickyElementHeight + this.headerHeight + this.bottomGap > this.screenHeight) {
      let newInset;

      if (window.scrollY < this.currPos) {
        // Scroll up
        if (stickyElementTop < this.headerHeight) {
          newInset = Math.min(stickyElementTop + scrollDelta, this.headerHeight);
        } else {
          newInset = this.headerHeight;
        }
      } else {
        // Scroll down
        if (stickyElementTop > this.endScroll) {
          newInset = Math.max(stickyElementTop + scrollDelta, this.endScroll);
        } else {
          newInset = this.endScroll;
        }
      }

      if (Math.abs(newInset - stickyElementTop) > 0.5) {
        this.style.setProperty('--inset', `${newInset.toFixed(1)}px`);
      }
    } else {
      this.style.setProperty('--inset', `${this.headerHeight.toFixed(1)}px`);
    }

    this.currPos = window.scrollY;
  }
}
customElements.define('sticky-element', StickyElement);

class ParallaxElement extends BaseElementMixin(HTMLDivElement) {
  connectedCallback() {
    super.connectedCallback();

    this.load();

    this.on(document, 'matchSmall', this.unload.bind(this));
    this.on(document, 'unmatchSmall', this.load.bind(this));

    this.registerCleanup(() => this.unload());
  }

  get mobileDisabled() {
    return false;
  }

  load() {
    if (theme.config.motionReduced) return;
    if (this.mobileDisabled && (theme.config.isTouch || theme.config.mqlSmall)) return;

    this.motion();
  }

  motion() {
    this.cancelParallax = Motion.scroll(
      Motion.animate(this, { transform: [`translateY(${this.getAttribute('data-start')})`, `translateY(${this.getAttribute('data-stop')})`] }),
      { target: this, offset: Motion.ScrollOffset.Any }
    );
  }

  unload() {
    if (this.cancelParallax) {
      this.cancelParallax();
      this.style.transform = null;
    }
  }
}
customElements.define('parallax-element', ParallaxElement, { extends: 'div' });

class ParallaxOverlay extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.load();

    if (Shopify.designMode) {
      this.on(document, 'shopify:section:unload', this.refresh.bind(this));
    }
  }

  refresh() {
    let options = {};
    options[this.getAttribute('data-target')] = this.getAttribute('data-stop');

    Motion.animate(this, options, { duration: 0 });
  }

  load() {
    let options = {};
    options[this.getAttribute('data-target')] = [this.getAttribute('data-start'), this.getAttribute('data-stop')];

    const cancelParallax = Motion.scroll(
      Motion.animate(this, options),
      { target: this.parentElement, offset: Motion.ScrollOffset.Enter }
    );
    this.registerCleanup(cancelParallax);
  }
}
customElements.define('parallax-overlay', ParallaxOverlay);

class FooterParallax extends ParallaxElement {
  connectedCallback() {
    super.connectedCallback();

    if (Shopify.designMode) {
      this.on(document, 'shopify:section:unload', this.refresh.bind(this));
    }
  }

  get mobileDisabled() {
    return true;
  }

  motion() {
    this.cancelParallax = Motion.scroll(
      Motion.animate(this, { transform: ['translateY(-50%)', 'translateY(0)'] }),
      { target: this, offset: Motion.ScrollOffset.Enter }
    );
  }

  refresh() {
    if (theme.config.motionReduced) return;
    if (this.mobileDisabled && (theme.config.isTouch || theme.config.mqlSmall)) return;

    setTimeout(() => {
      Motion.animate(this, { transform: 'translateY(0)' }, { duration: 0 });
    });
  }
}
customElements.define('footer-parallax', FooterParallax, { extends: 'div' });

class FooterGroup extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.init();

    if (Shopify.designMode) {
      this.on(document, 'shopify:section:load', this.init.bind(this));
    }
  }

  get rounded() {
    return Array.from(this.querySelectorAll('.section--rounded'));
  }

  get sections() {
    return Array.from(this.querySelectorAll('.shopify-section'));
  }

  init() {
    this.sections.forEach((shopifySection, index) => {
      const section = shopifySection.querySelector('.section');
      if (section) {
        section.classList.remove('section--next-rounded');
        section.style.zIndex = this.sections.length - index;
      }
    });

    this.rounded.forEach((section) => {
      const shopifySection = section.closest('.shopify-section');
      let previousShopifySection = shopifySection.previousElementSibling;

      if (previousShopifySection === null) {
        previousShopifySection = document.querySelector('.main-content .shopify-section:last-child');
      }

      if (previousShopifySection) {
        const previousSection = previousShopifySection.querySelector('.section');
        if (previousSection) {
          previousSection.classList.add('section--next-rounded');
        }
      }
    });
  }
}
customElements.define('footer-group', FooterGroup, { extends: 'footer' });

class CarouselElement extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
  }

  get items() {
    return this._items = this._items || Array.from(this.children);
  }

  get watchCSS() {
    return this.hasAttribute('watch-css');
  }

  get initialIndex() {
    return parseInt(this.getAttribute('initial-index') || 0);
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (this.items.length > 1) {
      this.carousel = new Flickity(this, {
        watchCSS: this.watchCSS,
        prevNextButtons: false,
        adaptiveHeight: true,
        wrapAround: true,
        rightToLeft: theme.config.rtl,
        initialIndex: this.initialIndex,
      });

      this.carousel.on('change', this.onChange.bind(this));
      this.bindEvents();
    }
  }

  bindEvents() {
    if (!this.carousel) return;

    this.on(this, 'control:select', (event) => this.select(event.detail.index));

    if (Shopify.designMode) {
      this.on(this, 'shopify:block:select', (event) => this.carousel.select(this.items.indexOf(event.target)));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.carousel) this.carousel.destroy();
  }

  select(index = 0, immediate = false) {
    if (!immediate) {
      const { selectedIndex, slides } = this.carousel;

      immediate = Math.abs(index - selectedIndex) > 3;

      if (index === 0 && selectedIndex === slides.length - 1) {
        immediate = false;
      }

      if (index === slides.length - 1 && selectedIndex === 0) {
        immediate = false;
      }
    }
    this.carousel.select(index, false, immediate);
  }

  onChange(index) {
    this.dispatchEvent(new CustomEvent('carousel:change', { bubbles: true, detail: { index } }));
  }
}
customElements.define('carousel-element', CarouselElement);

class TestimonialsElement extends CarouselElement {
  constructor() {
    super();

    Motion.inView(this, () => {
      setTimeout(() => this.update(), 600);
    });
  }

  update() {
    if (this.carousel) this.carousel.select(0);
  }
}
customElements.define('testimonials-element', TestimonialsElement);

class SecondaryMedia extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
  }

  get template() {
    return this.previousElementSibling;
  }

  static get observedAttributes() {
    return ['selected-index'];
  }

  get selectedIndex() {
    return parseInt(this.getAttribute('selected-index')) || 0;
  }

  set selectedIndex(index) {
    this.setAttribute('selected-index', Math.min(Math.max(index, 0), this.items.length - 1).toString());
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.carousel) this.carousel.destroy();
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.hydrated) {
      this.hydrated = true;
      this.appendChild(this.template.content.cloneNode(true));
    }
    this.mediaCount = this.querySelectorAll('.media').length;
    this.items = Array.from(this.children);

    if (this.mediaCount > 1) {
      this.style.visibility = 'hidden';

      this.carousel = new Flickity(this, {
        accessibility: false,
        draggable: false,
        pageDots: true,
        prevNextButtons: false,
        wrapAround: true,
        rightToLeft: theme.config.rtl,
        on: {
          ready: () => {
            this.style.visibility = 'visible';
          }
        }
      });

      if (this.mediaCount === 2) {
        this.classList.add('without-dots');
      }

      this.carousel.on('change', this.onChange.bind(this));
      this.bindEvents();
    }
  }

  bindEvents() {
    if (!this.carousel) return;

    this.on(this, 'mousemove', this.onMoveHandler);
    this.on(this, 'mouseleave', this.onLeaveHandler);
  }

  onMoveHandler(event) {
    if (this.mediaCount === 2) {
      return this.carousel.select(1);
    }

    const { width } = this.carousel.size;
    const mouseX = event.clientX - this.getBoundingClientRect().left;

    if (this.mediaCount === 3) {
      if (mouseX < width / 2) {
        return this.carousel.select(1);
      }
      return this.carousel.select(2);
    }

    if (this.mediaCount === 4) {
      if (mouseX < width / 3) {
        return this.carousel.select(1);
      }
      if (mouseX < (2 * width) / 3) {
        return this.carousel.select(2);
      }
      return this.carousel.select(3);
    }
  }

  onLeaveHandler() {
    this.carousel.select(0);
  }

  onChange() {
    this.selectedIndex = this.carousel.selectedIndex;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'selected-index' && oldValue !== null && oldValue !== newValue) {
      const fromElement = this.items[parseInt(oldValue)];
      const toElement = this.items[parseInt(newValue)];

      if (fromElement.tagName === 'VIDEO-MEDIA') {
        fromElement?.pause();
      }

      if (toElement.tagName === 'VIDEO-MEDIA') {
        toElement?.play();
      }
    }
  }
}
customElements.define('secondary-media', SecondaryMedia);

class MotionList extends HTMLElement {
  constructor() {
    super();

    this.isMobile = theme.config.mqlSmall || theme.config.isTouch;
    this.motionReduced = theme.config.motionReduced || this.hasAttribute('motion-reduced');

    if (this.motionReduced || this.initialized) return;

    this.unload();
    Motion.inView(this, this.load.bind(this));
  }

  get items() {
    return Array.from(this.querySelectorAll('.card'));
  }

  get itemsToShow() {
    return Array.from(this.querySelectorAll('.card:not([style])'));
  }

  get initialized() {
    return this.hasAttribute('initialized');
  }

  getAnimationParams() {
    return {
      distance: this.isMobile ? 30 : 50,
      duration: this.motionReduced ? 0.001 : (this.isMobile ? 0.3 : 0.5),
      staggerDelay: this.motionReduced ? 0 : (this.isMobile ? 0.05 : 0.1)
    };
  }

  getVisibleItems(items) {
    const viewportHeight = window.innerHeight + window.scrollY;
    const visible = [];
    const invisible = [];

    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      const isVisible = rect.top < viewportHeight && rect.bottom > 0;

      if (isVisible) {
        visible.push(item);
      } else {
        invisible.push(item);
      }
    });

    return { visible, invisible };
  }

  unload() {
    const { distance } = this.getAnimationParams();
    const visibleItems = this.items;

    Motion.animate(visibleItems, { y: distance, opacity: 0, visibility: 'hidden' }, { duration: 0 });
  }

  async load() {
    const { distance, duration, staggerDelay } = this.getAnimationParams();
    const { visible: visibleItems, invisible: inVisibleItems } = this.getVisibleItems(this.items);

    await Motion.animate(visibleItems, { y: [distance, 0], opacity: [0, 1], visibility: ['hidden', 'visible'] }, { duration: duration, delay: Motion.stagger(staggerDelay) }).finished;
    Motion.animate(inVisibleItems, { y: [distance, 0], opacity: [0, 1], visibility: ['hidden', 'visible'] }, { duration: duration });

    this.items.forEach(item => item.style.removeProperty('transform'));
    this.setAttribute('initialized', '');
  }

  async reload() {
    const { distance, duration, staggerDelay } = this.getAnimationParams();
    const { visible: visibleItems, invisible: inVisibleItems } = this.getVisibleItems(this.itemsToShow);

    await Motion.animate(visibleItems, { y: [distance, 0], opacity: [0, 1], visibility: ['hidden', 'visible'] }, { duration: duration, delay: Motion.stagger(staggerDelay) }).finished;
    Motion.animate(inVisibleItems, { y: [distance, 0], opacity: [0, 1], visibility: ['hidden', 'visible'] }, { duration: duration });

    this.items.forEach(item => item.style.removeProperty('transform'));
  }
}
customElements.define('motion-list', MotionList);

class LazyBackground extends HTMLElement {
  constructor() {
    super();

    this.init();
  }

  get image() {
    const style = window.getComputedStyle(this);
    return style.backgroundImage ? style.backgroundImage.slice(5, -2).replace('width=1', 'width=720') : false;
  }

  async init() {
    if (!this.image) return;

    const img = document.createElement('img');
    img.src = this.image;
    img.style.visibility = 'hidden';
    img.style.position = 'absolute';

    await theme.utils.imageLoaded(img);
    this.style.backgroundImage = `url(${this.image})`;
    img.remove();
  }
}
customElements.define('lazy-background', LazyBackground);

class MenuToggle extends MagnetButton {
  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'click', this.onClick);
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get expanded() {
    return this.getAttribute('aria-expanded') === 'true';
  }

  onClick() {
    this.setAttribute('aria-expanded', this.expanded ? 'false' : 'true');
    if (this.controlledElement) this.controlledElement.classList.toggle('active');
  }
}
customElements.define('menu-toggle', MenuToggle, { extends: 'button' });

class ScrollShadow extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this));
  }

  get template() {
    return this.querySelector('template');
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.bindEvents();
      this.load();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(this.template.content.cloneNode(true));
    this.updater = new theme.scrollShadow.Updater(this.shadowRoot.children[1]);

    this.bindEvents();
    this.load();
  }

  bindEvents() {
    this.on(this.shadowRoot, 'slotchange', () => this.load());
  }

  load() {
    this.updater.on(this.children[0]);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.updater?.on();
  }
}
customElements.define('scroll-shadow', ScrollShadow);

class CustomSelect extends BaseElementMixin(HTMLSelectElement) {
  connectedCallback() {
    super.connectedCallback();

    this.onChange();
    this.on(this, 'change', this.onChange);
  }

  onChange() {
    this.value !== '' || this.selectedIndex === -1 ? this.setAttribute('selected', '') : this.removeAttribute('selected');
  }
}
customElements.define('custom-select', CustomSelect, { extends: 'select' });

let googleMapsPromise = null;
class GMap extends HTMLElement {
  constructor() {
    super();

    if (!this.hasAttribute('data-api-key') || !this.hasAttribute('data-map-address')) {
      return;
    }

    Motion.inView(this, this.prepMapApi.bind(this), { margin: '600px 0px 600px 0px' });

    // Global function called by Google on auth errors.
    // Show an auto error message on all map instances.
    window.gm_authFailure = () => {

      // Show errors only to merchant in the editor.
      if (Shopify.designMode) {
        window.mapError(theme.strings.authError);
      }
    };

    window.mapError = (error, element) => {
      const container = element ? element.closest('.shopify-section') : document;
      container.querySelectorAll('.gmap--error').forEach((error) => {
        error.remove();
      });

      container.querySelectorAll('g-map').forEach((map) => {
        const message = document.createElement('div');
        message.classList.add('rte', 'alert', 'alert--error', 'gmap--error');
        message.innerHTML = error;
        map.closest('.with-map').prepend(message);
      });
    };

    window.gmNoop = () => { };
  }

  prepMapApi() {
    this.loadScript()
      .then(this.initMap.bind(this))
      .then(() => {
        setTimeout(() => {
          const container = this.closest('.banner__map');
          if (container && container.previousElementSibling) {
            container.previousElementSibling.classList.remove('opacity-0');
          }
        }, 1e3);
      });
  }

  loadScript() {
    if (window.google?.maps) return Promise.resolve();

    return googleMapsPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);
      script.onload = resolve;
      script.onerror = reject;
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.getAttribute('data-api-key')}&callback=gmNoop`;
    });
  }

  initMap() {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: this.getAttribute('data-map-address') }, (results, status) => {
      if (status !== google.maps.GeocoderStatus.OK) {

        // Show errors only to merchant in the editor.
        if (Shopify.designMode) {
          let errorMessage;

          switch (status) {
            case 'ZERO_RESULTS':
              errorMessage = theme.strings.addressNoResults;
              break;
            case 'OVER_QUERY_LIMIT':
              errorMessage = theme.strings.addressQueryLimit;
              break;
            case 'REQUEST_DENIED':
              errorMessage = theme.strings.authError;
              break;
            default:
              errorMessage = theme.strings.addressError;
              break;
          }
          window.mapError(errorMessage, this);
        }
      }
      else {
        const mapOptions = {
          zoom: parseInt(this.getAttribute('data-zoom')),
          center: results[0].geometry.location,
          draggable: true,
          clickableIcons: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          disableDefaultUI: true
        };

        const map = new google.maps.Map(this, mapOptions), center = map.getCenter();

        map.setCenter(center);

        const icon = {
          path: "M22.6746 0C10.2174 0 0 8.79169 0 21.5118C0 31.2116 4.33864 38.333 9.26606 42.998C11.7232 45.3243 14.3387 47.0534 16.6674 48.2077C18.9384 49.3333 21.1148 50 22.6746 50C24.2345 50 26.4108 49.3333 28.6818 48.2077C31.0105 47.0534 33.626 45.3243 36.0832 42.998C41.0106 38.333 45.3492 31.2116 45.3492 21.5118C45.3492 8.79169 35.1318 0 22.6746 0ZM29.6514 22.6746C29.6514 26.5278 26.5278 29.6514 22.6746 29.6514C18.8214 29.6514 15.6978 26.5278 15.6978 22.6746C15.6978 18.8214 18.8214 15.6978 22.6746 15.6978C26.5278 15.6978 29.6514 18.8214 29.6514 22.6746Z",
          fillColor: this.getAttribute('data-marker-color'),
          fillOpacity: 1,
          anchor: new google.maps.Point(15, 55),
          strokeWeight: 0,
          scale: 0.7
        };

        new google.maps.Marker({
          map: map,
          position: map.getCenter(),
          icon: icon
        });

        const styledMapType = new google.maps.StyledMapType(JSON.parse(this.parentNode.querySelector('[data-gmap-style]').innerHTML));

        map.mapTypes.set('styled_map', styledMapType);
        map.setMapTypeId('styled_map');
      }
    });
  }
}
customElements.define('g-map', GMap);

class GMapLocations extends BaseElementMixin(HTMLUListElement) {
  connectedCallback() {
    super.connectedCallback();

    this.selectedIndex = this.selectedIndex;
    this.buttons.forEach((button, index) => this.on(button, 'click', () => this.selectedIndex = index));

    if (Shopify.designMode) {
      this.on(this, 'shopify:block:select', (event) => this.selectedIndex = this.buttons.indexOf(event.target));
    }
  }

  static get observedAttributes() {
    return ['selected-index'];
  }

  get selectedIndex() {
    return parseInt(this.getAttribute('selected-index')) || 0;
  }

  set selectedIndex(index) {
    this.setAttribute('selected-index', Math.min(Math.max(index, 0), this.buttons.length - 1).toString());
  }

  get buttons() {
    return this._buttons = this._buttons || Array.from(this.hasAttribute('selector') ? this.querySelectorAll(this.getAttribute('selector')) : this.children);
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.buttons.forEach((button, index) => {
      button.classList.toggle('active', index === parseInt(newValue));
      button.querySelector('[data-map-button]')?.classList.toggle('button--secondary', index !== parseInt(newValue));
    });

    if (name === 'selected-index' && oldValue !== null && oldValue !== newValue) {
      if (this.controlledElement) {
        const button = this.buttons[parseInt(newValue)];
        this.controlledElement.setAttribute('data-map-address', button.getAttribute('data-map-address'));
        this.controlledElement.initMap();
      }
    }
  }
}
customElements.define('g-map-locations', GMapLocations, { extends: 'ul' });

class PreviousButton extends HoverButton {
  connectedCallback() {
    super.connectedCallback();

    this.load();
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  load() {
    this.onClickListener = this.onClick.bind(this);
    this.on(this, 'click', this.onClickListener);

    if (this.controlledElement) {
      this.updateStatusListener = this.updateStatus.bind(this);
      this.on(this.controlledElement, 'slider:previousStatus', this.updateStatusListener);
    }
  }

  unload() {
    this.removeEventListener('click', this.onClickListener);
    if (this.controlledElement) {
      this.controlledElement.removeEventListener('slider:previousStatus', this.updateStatusListener);
    }
  }

  onClick() {
    (this.controlledElement ?? this).dispatchEvent(new CustomEvent('slider:previous', { bubbles: true, cancelable: true }));
  }

  updateStatus(event) {
    switch (event.detail.status) {
      case 'hidden':
        this.hidden = true;
        break;

      case 'disabled':
        this.disabled = true;
        break;

      default:
        this.hidden = false;
        this.disabled = false;
    }
  }
}
customElements.define('previous-button', PreviousButton, { extends: 'button' });

class NextButton extends HoverButton {
  connectedCallback() {
    super.connectedCallback();

    this.load();
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  load() {
    this.onClickListener = this.onClick.bind(this);
    this.on(this, 'click', this.onClickListener);

    if (this.controlledElement) {
      this.updateStatusListener = this.updateStatus.bind(this);
      this.on(this.controlledElement, 'slider:nextStatus', this.updateStatusListener);
    }
  }

  unload() {
    this.removeEventListener('click', this.onClickListener);
    if (this.controlledElement) {
      this.controlledElement.removeEventListener('slider:nextStatus', this.updateStatusListener);
    }
  }

  onClick() {
    (this.controlledElement ?? this).dispatchEvent(new CustomEvent('slider:next', { bubbles: true, cancelable: true }));
  }

  updateStatus(event) {
    switch (event.detail.status) {
      case 'hidden':
        this.hidden = true;
        break;

      case 'disabled':
        this.disabled = true;
        break;

      default:
        this.hidden = false;
        this.disabled = false;
    }
  }
}
customElements.define('next-button', NextButton, { extends: 'button' });

class SliderElement extends BaseElement {
  // TBG custom Code
  disconnectedCallback() {
    this.teardownPdpMediaGalleryTracking?.();
  }

  disconnectedCallback() {
    this.teardownPdpMediaGalleryTracking?.();
  }
  constructor() {
    super();

    this.adjustHeight = this.adjustHeight.bind(this);
    Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
  }

  get looping() {
    return false;
  }

  get items() {
    return this._items = this._items || Array.from(this.hasAttribute('selector') ? this.querySelectorAll(this.getAttribute('selector')) : this.children);
  }

  get itemsToShow() {
    return Array.from(this.items).filter(element => element.clientWidth > 0);
  }

  // TBG custom Code
  get lastPage() {
    return this.itemsToShow.length;
  }

  get mobileForwardLoopEnabled() {
    return this.hasAttribute('data-mobile-forward-loop') && window.matchMedia('screen and (max-width: 767px)').matches;
  }

  get itemOffset() {
    if (theme.config.rtl) {
      return this.itemsToShow.length > 1 ? this.itemsToShow[0].offsetLeft - this.itemsToShow[1].offsetLeft : 0;
    }

    return this.itemsToShow.length > 1 ? this.itemsToShow[1].offsetLeft - this.itemsToShow[0].offsetLeft : 0;
  }

  get perPage() {
    let elementWidth = this.clientWidth;
    const mql = window.matchMedia('screen and (min-width: 1280px)');
    if (mql.matches) {
      const styles = window.getComputedStyle(this);
      elementWidth = this.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    }

    return Math.floor(elementWidth / this.itemOffset);
  }

  get isScrollable() {
    const style = window.getComputedStyle(this);
    const hasScrollableOverflow = style.overflow === 'scroll' || style.overflow === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'auto';
    const hasScrollableContent = this.scrollHeight > this.clientHeight || this.scrollWidth > this.clientWidth;

    return hasScrollableOverflow && hasScrollableContent;
  }

  get isSlider() {
    return this.scrollWidth > this.clientWidth + 1;
  }


  reset() {
    this._items = Array.from(this.hasAttribute('selector') ? this.querySelectorAll(this.getAttribute('selector')) : this.children);
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.hasPendingOnScroll = false;
    this.currentPage = 1;
    this.updateButtons();
    this.updateTabindex();

    this.on(this, 'scroll', theme.utils.debounce(this.update.bind(this), 50));
    this.on(this, 'scrollend', this.scrollend);
    this.on(this, 'slider:previous', this.previous);
    this.on(this, 'slider:next', this.next);
    this.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    this.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
    this.on(document, 'matchSmall', this.updateTabindex.bind(this));
    this.on(document, 'unmatchSmall', this.updateTabindex.bind(this));

    if (this.hasAttribute('adaptive-height')) {
      this.on(this, 'slider:change', this.adjustHeight);

      this.on(window, 'resize', theme.utils.debounce(this.adjustHeight, 100));

      this.adjustHeight();
    }

    if (Shopify.designMode) {
      this.on(this, 'shopify:block:select', (event) => event.target.scrollIntoView({ behavior: 'smooth' }));
    }

    // TBG custom Code
    this.initPdpMediaGalleryTracking?.();
  }

  previous() {
    this.scrollPosition = this.scrollLeft - this.perPage * this.itemOffset * (theme.config.rtl ? -1 : 1);
    this.scrollToPosition(this.scrollPosition);
  }

  next() {
    // TBG custom Code
    if (this.mobileForwardLoopEnabled && this.lastPage > 1 && this.currentPage >= this.lastPage) {
      this.wrapToFirst();
      return;
    }

    this.scrollPosition = this.scrollLeft + this.perPage * this.itemOffset * (theme.config.rtl ? -1 : 1);
    this.scrollToPosition(this.scrollPosition);
  }

  select(selectedIndex, immediate = false) {
    this.scrollPosition = this.scrollLeft - (this.currentPage - selectedIndex) * this.itemOffset * (theme.config.rtl ? -1 : 1);
    this.scrollToPosition(this.scrollPosition, immediate);
  }

  selected(selectedIndex) {
    return this.itemsToShow[selectedIndex];
  }

  scrollend() {
    this.hasPendingOnScroll = false;
    this.dispatchEventHandler();
  }

  // TBG custom Code
  onTouchStart(event) {
    if (!this.mobileForwardLoopEnabled || event.touches.length !== 1) {
      this.touchStartX = null;
      this.touchStartY = null;
      this.touchStartPage = null;
      return;
    }

    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.touchStartPage = this.currentPage;
  }

  onTouchEnd(event) {
    if (!this.mobileForwardLoopEnabled || this.lastPage <= 1 || this.touchStartX == null || event.changedTouches.length !== 1) {
      return;
    }

    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    const deltaY = event.changedTouches[0].clientY - this.touchStartY;

    this.touchStartX = null;
    this.touchStartY = null;
    const touchStartPage = this.touchStartPage;
    this.touchStartPage = null;

    if (Math.abs(deltaX) < 30 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    const isForwardSwipe = theme.config.rtl ? deltaX > 0 : deltaX < 0;

    if (isForwardSwipe && touchStartPage === this.lastPage && this.currentPage === this.lastPage) {
      this.wrapToFirst();
    }
  }

  update() {
    if (window.onscrollend === void 0) {
      clearTimeout(this.scrollendTimeout);
    }

    const previousPage = this.currentPage;
    this.currentPage = Math.round(Math.abs(this.scrollLeft) / this.itemOffset) + 1;

    if (this.currentPage !== previousPage) {
      if (!this.hasPendingOnScroll) {
        this.dispatchEventHandler();
      }

      this.itemsToShow.forEach((sliderItem, index) => {
        sliderItem.classList.toggle('selected', index + 1 === this.currentPage);
      });
    }

    if (window.onscrollend === void 0) {
      this.scrollendTimeout = setTimeout(() => {
        this.dispatchEvent(new CustomEvent('scrollend', { bubbles: true, composed: true }));
      }, 75);
    }

    if (this.looping) return;

    this.updateButtons();
  }

  updateButtons() {
    let previousDisabled = this.currentPage === 1;
    let nextDisabled = this.currentPage === this.itemsToShow.length;

    if (this.perPage > 1) {
      previousDisabled = previousDisabled || this.itemsToShow.length > 0 && this.isVisible(this.itemsToShow[0]) && this.scrollLeft === 0;
      nextDisabled = nextDisabled || this.itemsToShow.length > 0 && this.isVisible(this.itemsToShow[this.itemsToShow.length - 1]);
    }

    this.dispatchEvent(
      new CustomEvent('slider:previousStatus', {
        bubbles: true,
        detail: {
          status: previousDisabled ? (nextDisabled ? 'hidden' : 'disabled') : 'visible'
        },
      })
    );
    this.dispatchEvent(
      new CustomEvent('slider:nextStatus', {
        bubbles: true,
        detail: {
          status: nextDisabled ? (previousDisabled ? 'hidden' : 'disabled') : 'visible'
        },
      })
    );
  }

  updateTabindex() {
    this.removeAttribute('tabindex');

    if (this.isScrollable) {
      this.setAttribute('tabindex', '0');
    }
  }

  isVisible(element, offset = 0) {
    const lastVisibleSlide = this.clientWidth + this.scrollLeft - offset;
    return element.offsetLeft + element.clientWidth <= lastVisibleSlide && element.offsetLeft >= this.scrollLeft;

    /*
    const lastVisibleSlide = this.clientWidth + this.scrollLeft - offset;
    const offsetLeft = element.getBoundingClientRect().left;
    return offsetLeft + element.clientWidth <= lastVisibleSlide && offsetLeft >= this.scrollLeft;
    */
  }

  scrollToPosition(position, immediate = false) {
    this.hasPendingOnScroll = !immediate;

    this.scrollTo({
      left: position,
      behavior: immediate ? 'instant' : theme.config.motionReduced ? 'auto' : 'smooth'
    });
  }

  dispatchEventHandler() {
    this.dispatchEvent(
      new CustomEvent('slider:change', {
        detail: {
          currentPage: this.currentPage,
          currentElement: this.itemsToShow[this.currentPage - 1],
        },
      })
    );
  }

  // TBG custom Code
  wrapToFirst(immediate = false) {
    this.select(1, immediate);
  }

  initPdpMediaGalleryTracking() {
    if (!this.hasAttribute('data-pdp-media-gallery-tracking') || this.pdpMediaGalleryTrackingInitialized) return;

    this.pdpMediaGalleryTrackingInitialized = true;
    this.pdpMediaGalleryBaseProperties = {
      page_type: 'product',
      product_id: this.getAttribute('data-product-id'),
      product_handle: this.getAttribute('data-product-handle') || '',
      product_title: this.getAttribute('data-product-title') || '',
    };

    this.onPdpMediaGallerySync = theme.utils.throttle(() => this.syncPdpMediaGalleryState('viewport'));
    this.onPdpMediaGallerySliderChange = (event) => this.syncPdpMediaGalleryState('slider:change', event);
    this.onPdpMediaGalleryVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.capturePdpMediaGalleryMaxCount();
      }
    };
    this.onPdpMediaGalleryPageHide = () => this.capturePdpMediaGalleryMaxCount();

    this.addEventListener('slider:change', this.onPdpMediaGallerySliderChange);
    this.addEventListener('scroll', this.onPdpMediaGallerySync, { passive: true });
    window.addEventListener('scroll', this.onPdpMediaGallerySync, { passive: true });
    window.addEventListener('resize', this.onPdpMediaGallerySync, { passive: true });
    window.addEventListener('load', this.onPdpMediaGallerySync);
    document.addEventListener('visibilitychange', this.onPdpMediaGalleryVisibilityChange);
    window.addEventListener('pagehide', this.onPdpMediaGalleryPageHide);
    window.addEventListener('beforeunload', this.onPdpMediaGalleryPageHide);

    if ('IntersectionObserver' in window) {
      this.pdpMediaGalleryObserver = new IntersectionObserver(
        () => this.syncPdpMediaGalleryState('intersection'),
        { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
      );

      this.getPdpMediaGalleryItems().forEach((item) => this.pdpMediaGalleryObserver.observe(item));
    }

    this.pdpMediaGalleryState = {
      activeIndex: 1,
      visibleIndexes: [1],
      maxSeenCount: 1,
      maxCountSent: false,
      engagedSent: false,
      lastSource: 'init',
      sliderIndex: 1,
    };
    this.syncPdpMediaGalleryState('init');
  }

  // TBG custom Code
  teardownPdpMediaGalleryTracking() {
    if (!this.pdpMediaGalleryTrackingInitialized) return;

    this.removeEventListener('slider:change', this.onPdpMediaGallerySliderChange);
    this.removeEventListener('scroll', this.onPdpMediaGallerySync);
    window.removeEventListener('scroll', this.onPdpMediaGallerySync);
    window.removeEventListener('resize', this.onPdpMediaGallerySync);
    window.removeEventListener('load', this.onPdpMediaGallerySync);
    document.removeEventListener('visibilitychange', this.onPdpMediaGalleryVisibilityChange);
    window.removeEventListener('pagehide', this.onPdpMediaGalleryPageHide);
    window.removeEventListener('beforeunload', this.onPdpMediaGalleryPageHide);

    if (this.pdpMediaGalleryObserver) {
      this.pdpMediaGalleryObserver.disconnect();
      this.pdpMediaGalleryObserver = null;
    }

    this.pdpMediaGalleryTrackingInitialized = false;
  }

  // TBG custom Code
  getPdpMediaGalleryItems() {
    return Array.from(this.querySelectorAll('[data-media-id]'));
  }

  // TBG custom Code
  isPdpMediaGalleryItemTrackable(item) {
    if (!item || item.hasAttribute('hidden')) return false;

    const style = window.getComputedStyle(item);
    const rect = item.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  // TBG custom Code
  getPdpMediaGallerySliderIndex(event) {
    const eventPage = Number(event?.detail?.currentPage);
    if (Number.isFinite(eventPage) && eventPage > 0) return eventPage;

    const sliderPage = Number(this.currentPage);
    if (Number.isFinite(sliderPage) && sliderPage > 0) return sliderPage;

    return 1;
  }

  // TBG custom Code
  getPdpMediaGalleryViewportState(event) {
    const items = this.getPdpMediaGalleryItems();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportCenterY = viewportHeight / 2;
    const viewportCenterX = viewportWidth / 2;
    const sliderIndex = this.getPdpMediaGallerySliderIndex(event);

    let activeIndex = sliderIndex;
    let bestScore = -Infinity;
    const visibleIndexes = [];

    items.forEach((item, index) => {
      if (!this.isPdpMediaGalleryItemTrackable(item)) return;

      const rect = item.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;
      if (visibleArea <= 0) return;

      const itemIndex = index + 1;
      visibleIndexes.push(itemIndex);

      const itemCenterY = rect.top + rect.height / 2;
      const itemCenterX = rect.left + rect.width / 2;
      const distanceY = Math.abs(itemCenterY - viewportCenterY);
      const distanceX = Math.abs(itemCenterX - viewportCenterX);
      const score = visibleArea - (distanceY * 10) - distanceX;

      if (score > bestScore) {
        bestScore = score;
        activeIndex = itemIndex;
      }
    });

    if (!visibleIndexes.length) {
      visibleIndexes.push(activeIndex);
    }

    return { activeIndex, visibleIndexes, sliderIndex };
  }

  // TBG custom Code
  syncPdpMediaGalleryState(source = 'manual', event = null) {
    if (!this.pdpMediaGalleryState) return;

    const viewportState = this.getPdpMediaGalleryViewportState(event);
    const maxVisibleIndex = viewportState.visibleIndexes.length ? Math.max(...viewportState.visibleIndexes) : viewportState.activeIndex;

    this.pdpMediaGalleryState.activeIndex = viewportState.activeIndex;
    this.pdpMediaGalleryState.visibleIndexes = viewportState.visibleIndexes;
    this.pdpMediaGalleryState.lastSource = source;
    this.pdpMediaGalleryState.sliderIndex = viewportState.sliderIndex;
    this.pdpMediaGalleryState.maxSeenCount = Math.max(
      this.pdpMediaGalleryState.maxSeenCount,
      viewportState.activeIndex,
      maxVisibleIndex,
      viewportState.sliderIndex
    );

    if (this.pdpMediaGalleryState.maxSeenCount > 1) {
      this.capturePdpMediaGalleryEngaged();
    }
  }

  // TBG custom Code
  canCapturePdpMediaGallery() {
    return window.posthog && typeof window.posthog.capture === 'function';
  }

  // TBG custom Code
  capturePdpMediaGalleryEngaged() {
    if (!this.pdpMediaGalleryState || this.pdpMediaGalleryState.engagedSent || !this.canCapturePdpMediaGallery()) return;

    this.pdpMediaGalleryState.engagedSent = true;
    window.posthog.capture('PDP Media Gallery Engaged', this.pdpMediaGalleryBaseProperties);
  }

  // TBG custom Code
  capturePdpMediaGalleryMaxCount() {
    if (!this.pdpMediaGalleryState) return;

    this.syncPdpMediaGalleryState('flush');
    if (this.pdpMediaGalleryState.maxCountSent || !this.canCapturePdpMediaGallery()) return;

    this.pdpMediaGalleryState.maxCountSent = true;
    window.posthog.capture('PDP Max Media Gallery Count', {
      ...this.pdpMediaGalleryBaseProperties,
      max_media_gallery_count: this.pdpMediaGalleryState.maxSeenCount
    });
  }

  adjustHeight() {
    if (!this.isSlider) {
      this.style.maxHeight = '';
      return;
    }

    const currentElement = this.itemsToShow[this.currentPage - 1];
    if (!currentElement) return;

    if (currentElement.clientHeight !== this.clientHeight) {
      this.style.maxHeight = `${currentElement.clientHeight}px`;
    }
  }
}
customElements.define('slider-element', SliderElement);

class SliderDots extends BaseElement {
  constructor() {
    super();

    new theme.initWhenVisible(this.init.bind(this));
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get items() {
    return this._items = this._items || Array.from(this.children);
  }

  get itemsToShow() {
    return Array.from(this.items).filter(element => element.clientWidth > 0);
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (this.controlledElement) {
      this.on(this.controlledElement, 'slider:change', this.onChange.bind(this));

      this.items.forEach((item) => {
        this.on(item, 'click', this.onButtonClick.bind(this));
      });
    }
  }

  reset() {
    this._items = Array.from(this.children);
  }

  onChange(event) {
    this.transitionTo(parseInt(event.detail.currentPage) - 1);

    this.itemsToShow.forEach((item) => {
      item.setAttribute('aria-current', parseInt(item.getAttribute('data-index')) === parseInt(event.detail.currentPage) ? 'true' : 'false');
    });
  }

  transitionTo(selectedIndex, immediate = false) {
    if (this.itemsToShow[selectedIndex]) {
      const scrollElement = this.hasAttribute('align-selected') ? this.closest(this.getAttribute('align-selected')) : this;
      scrollElement?.scrollTo({
        left: this.itemsToShow[selectedIndex].offsetLeft - scrollElement.clientWidth / 2 + this.itemsToShow[selectedIndex].clientWidth / 2,
        top: this.itemsToShow[selectedIndex].offsetTop - scrollElement.clientHeight / 2 - this.itemsToShow[selectedIndex].clientHeight / 2,
        behavior: immediate ? 'instant' : theme.config.motionReduced ? 'auto' : 'smooth'
      });
    }
  }

  onButtonClick(event) {
    event.preventDefault();
    const target = event.currentTarget;

    this.itemsToShow.forEach((item) => {
      item.setAttribute('aria-current', item.getAttribute('data-index') === target.getAttribute('data-index') ? 'true' : 'false');
    });

    this.controlledElement.select(parseInt(target.getAttribute('data-index')));
  }
}
customElements.define('slider-dots', SliderDots);

class ProgressBar extends HTMLElement {
  constructor() {
    super();

    if (this.hasAttribute('style')) return;

    Motion.inView(this, this.init.bind(this));
  }

  init() {
    this.style.setProperty('--progress', `${parseInt(this.getAttribute('data-value')) * 0.75 * 100 / parseInt(this.getAttribute('data-max'))}%`);
  }
}
customElements.define('progress-bar', ProgressBar);

const onYouTubePromise = new Promise((resolve) => {
  // The iframe API may already be loaded by a third-party app — in that case
  // onYouTubeIframeAPIReady already fired and would never resolve this promise.
  if (window.YT?.Player) {
    resolve();
    return;
  }
  const existingCallback = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    existingCallback?.();
    resolve();
  };
});
class DeferredMedia extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    if (this.posterElement) {
      this.on(this.posterElement, 'click', this.onPosterClick.bind(this));
    }

    if (this.autoplay && !this.autoplayArmed) {
      const connection = navigator.connection;
      if (connection && (connection.saveData || /2g/.test(connection.effectiveType || ''))) {
        // Data Saver / very slow (2g): keep the poster, skip the video download entirely.
      }
      else {
        const arm = () => {
          if (this.autoplayArmed) return;
          this.autoplayArmed = true;

          if (this.hasAttribute('data-inview-full')) {
            // Play only while ~fully visible; any edge cut pauses.
            const observer = new IntersectionObserver((entries) => {
              const entry = entries[entries.length - 1];
              if (entry.intersectionRatio >= 0.99) {
                if (!this.paused) this.play();
              }
              else {
                this.pause();
              }
            }, { threshold: 0.99 });
            observer.observe(this);
          }
          else {
            Motion.inView(this, this.init.bind(this));
          }
        };
        if (document.readyState === 'complete') {
          arm();
        }
        else {
          this.on(window, 'load', () => {
            'requestIdleCallback' in window ? requestIdleCallback(arm, { timeout: 1000 }) : setTimeout(arm, 200);
          }, { once: true });
        }
      }
    }
  }

  get posterElement() {
    return this.querySelector('[id^="DeferredPoster-"]');
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get autoplay() {
    return this.hasAttribute('autoplay');
  }

  get playing() {
    return this.hasAttribute('playing');
  }

  get player() {
    return this.playerProxy = this.playerProxy || new Proxy(this.playerTarget(), {
      get: (target, prop) => {
        return async () => {
          target = await target;
          this.playerHandler(target, prop);
        };
      }
    });
  }

  static get observedAttributes() {
    return ['playing'];
  }

  onPosterClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.playing) {
      this.paused = true;
      this.pause();
    }
    else {
      this.paused = false;
      this.play();
    }
  }

  init() {
    if (!this.paused) {
      this.play();
    }
    return () => {
      this.pause();
    };
  }

  play() {
    if (!this.playing) {
      this.player.play();
    }
  }

  pause() {
    if (this.playing) {
      this.player.pause();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'playing') {
      if (oldValue === null && newValue === '') {
        return this.dispatchEvent(new CustomEvent('video:play', { bubbles: true }));
      }

      if (newValue === null) {
        return this.dispatchEvent(new CustomEvent('video:pause', { bubbles: true }));
      }
    }
  }
}

class VideoMedia extends DeferredMedia {

  playerTarget() {
    if (this.hasAttribute('host')) {
      this.setAttribute('loaded', '');
      this.closest('.media')?.classList.remove('loading');

      return new Promise(async (resolve) => {
        const templateElement = this.querySelector('template');
        if (templateElement) {
          templateElement.replaceWith(templateElement.content.firstElementChild.cloneNode(true));
        }
        const muteVideo = this.hasAttribute('autoplay') || window.matchMedia('screen and (max-width: 1023px)').matches;
        const script = document.createElement('script');
        script.type = 'text/javascript';
        if (this.getAttribute('host') === 'youtube') {
          if (!window.YT || !window.YT.Player) {
            script.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(script);
            await new Promise((resolve2) => {
              script.onload = resolve2;
            });
          }
          await onYouTubePromise;
          const player = new YT.Player(this.querySelector('iframe'), {
            events: {
              onReady: () => {
                if (muteVideo) {
                  player.mute();
                }
                this._hostPlayer = player;
                resolve(player);
              },
              onStateChange: (event) => {
                if (event.data === YT.PlayerState.PLAYING) {
                  this.setAttribute('playing', '');
                }
                else if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
                  this.removeAttribute('playing');
                }
              }
            }
          });
        }
        if (this.getAttribute('host') === 'vimeo') {
          if (!window.Vimeo || !window.Vimeo.Player) {
            script.src = 'https://player.vimeo.com/api/player.js';
            document.head.appendChild(script);
            await new Promise((resolve2) => {
              script.onload = resolve2;
            });
          }
          const player = new Vimeo.Player(this.querySelector('iframe'));
          if (muteVideo) {
            player.setMuted(true);
          }
          player.on('play', () => {
            this.setAttribute('playing', '');
          });
          player.on('pause', () => this.removeAttribute('playing'));
          player.on('ended', () => this.removeAttribute('playing'));
          this._hostPlayer = player;
          resolve(player);
        }
      });
    }
    else {
      let video;
      const templateElement = this.querySelector('template');

      if (templateElement) {
        video = templateElement.content.firstElementChild.cloneNode(true);
        video.addEventListener('loadedmetadata', () => this.setLoadedState(), { once: true });
        templateElement.replaceWith(video);
      } else {
        video = this.querySelector('video');
      }

      if (video && !templateElement) {
        if (video.readyState >= 1) {
          this.setLoadedState();
        } else {
          video.addEventListener('loadedmetadata', () => this.setLoadedState(), { once: true });
        }
      }

      const player = video;
      if (!player) return;

      if ('requestVideoFrameCallback' in player) {
        player.requestVideoFrameCallback(() => this.setAttribute('rendered', ''));
      } else {
        player.addEventListener('canplay', () => this.setAttribute('rendered', ''), { once: true });
      }

      player.addEventListener('play', () => {
        this.setAttribute('playing', '');
        this.removeAttribute('suspended');
      });

      player.addEventListener('pause', () => {
        if (!player.seeking && player.paused) {
          this.removeAttribute('playing');
        }
      });

      player.addEventListener('canplay', () => {
        if (this.hasAttribute('autoplay')) {
          requestAnimationFrame(() => {
            player.play().catch((error) => {
              if (error.name === 'NotAllowedError') {
                this.setAttribute('suspended', '');
                this.setAttribute('rendered', '');
                player.controls = true;
                const replacementImageSrc = player.previousElementSibling?.currentSrc;
                if (replacementImageSrc) {
                  player.poster = replacementImageSrc;
                }
              }
            });
          });
        }
      }, { once: true });

      return player;
    }
  }

  playerHandler(target, prop) {
    if (this.getAttribute('host') === 'youtube') {
      if (target && target.playVideo) {
        prop === 'play' ? target.playVideo() : target.pauseVideo();
      }
    }
    else {
      if (prop === 'play' && !this.hasAttribute('host')) {
        target.play().catch((error) => {
          if (error.name === 'NotAllowedError') {
            this.setAttribute('suspended', '');
            this.setAttribute('rendered', '');
            target.controls = true;
            const replacementImageSrc = target.previousElementSibling?.currentSrc;
            if (replacementImageSrc) {
              target.poster = replacementImageSrc;
            }
          }
        });
      }
      else {
        target[prop]();
      }
    }
  }

  setLoadedState() {
    this.setAttribute('loaded', '');
    this.closest('.media')?.classList.remove('loading');
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this._hostPlayer) {
      this._hostPlayer.destroy?.();
      this._hostPlayer = null;
    }
  }
}
customElements.define('video-media', VideoMedia);

class ModelMedia extends DeferredMedia {
  connectedCallback() {
    super.connectedCallback();

    if (this.closeElement) {
      this.on(this.closeElement, 'click', this.onCloseClick.bind(this));
    }
  }

  get closeElement() {
    return this.querySelector('[id^="DeferredPosterClose-"]');
  }

  onCloseClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.modelViewerUI) {
      this.modelViewerUI.pause();
    }
  }

  playerTarget() {
    return new Promise(() => {
      this.setAttribute('loaded', '');

      Shopify.loadFeatures([
        {
          name: 'shopify-xr',
          version: '1.0',
          onLoad: this.setupShopifyXR.bind(this),
        },
        {
          name: 'model-viewer-ui',
          version: '1.0',
          onLoad: this.setupModelViewerUI.bind(this),
        },
      ]);
    });
  }

  playerHandler(target, prop) {
    target[prop]();
  }

  async setupShopifyXR() {
    if (!window.ShopifyXR) {
      this._boundSetupShopifyXR = this._boundSetupShopifyXR || this.setupShopifyXR.bind(this);
      this.on(document, 'shopify_xr_initialized', this._boundSetupShopifyXR);
      return;
    }

    document.querySelectorAll('[id^="ProductJSON-"]').forEach((modelJSON) => {
      window.ShopifyXR.addModels(JSON.parse(modelJSON.textContent));
      modelJSON.remove();
    });
    window.ShopifyXR.setupXRElements();
  }

  setupModelViewerUI(errors) {
    if (errors) return;

    const modelViewer = this.querySelector('model-viewer');
    if (modelViewer && !modelViewer.hasAttribute('loaded')) {
      modelViewer.setAttribute('loaded', '');
      this.on(modelViewer, 'shopify_model_viewer_ui_toggle_play', this.modelViewerPlayed.bind(this));
      this.on(modelViewer, 'shopify_model_viewer_ui_toggle_pause', this.modelViewerPaused.bind(this));

      this.modelViewerUI = new Shopify.ModelViewerUI(modelViewer);
    }
  }

  modelViewerPlayed() {
    this.setAttribute('playing', '');
    this.closeElement.removeAttribute('hidden');
    (this.controlledElement ?? this).dispatchEvent(new CustomEvent('modelViewer:play', { bubbles: true }));
  }

  modelViewerPaused() {
    this.removeAttribute('playing');
    this.closeElement.setAttribute('hidden', '');
    (this.controlledElement ?? this).dispatchEvent(new CustomEvent('modelViewer:pause', { bubbles: true }));
  }
}
customElements.define('model-media', ModelMedia);

class VariantPicker extends BaseElement {
  constructor() {
    super();
    this.currentVariant = null;
    this.cachedVariantData = null;
    this.currentOptions = [];
    this.handleVariantChange = this.handleVariantChange.bind(this);
    this.handleOptionPreload = this.handleOptionPreload.bind(this);
  }

  get selectedOptionValues() {
    return Array.from(
      this.querySelectorAll('select option[selected], fieldset input:checked')
    ).map((el) => el.getAttribute('data-option-value-id'));
  }

  get optionContainers() {
    return Array.from(this.querySelectorAll('select, fieldset'));
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'change', this.handleVariantChange);
    this.on(this, 'pointerenter', this.handleOptionPreload, { capture: true });

    this.scheduleOptionWarmup();
  }

  // After idle: prefetch adjacent variants (HTML + image) for instant first switch. Main product only.
  scheduleOptionWarmup() {
    if (this.optionWarmupDone) return;

    const productInfo = this.closest('product-info');
    if (!productInfo || productInfo.hasAttribute('data-original-section-id')) return; // skip quick view

    const connection = navigator.connection;
    if (connection && (connection.saveData || /2g/.test(connection.effectiveType || ''))) return;

    const warm = () => {
      if (this.optionWarmupDone) return;
      this.optionWarmupDone = true;

      let budget = 12; // cap: protect merchants with very large option sets
      this.optionContainers.forEach((container) => {
        container.querySelectorAll('input[data-option-value-id]:not(:checked), option[data-option-value-id]:not([selected])').forEach((input) => {
          if (budget-- <= 0) return;
          const optionValues = this.optionContainers.map((other) => {
            if (other === container) return input.getAttribute('data-option-value-id');
            return other.querySelector('option[selected], input:checked')?.getAttribute('data-option-value-id');
          }).filter(Boolean);
          productInfo.preloadOptionValues?.(optionValues, input);
        });
      });
    };
    const idle = () => {
      'requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 5000 }) : setTimeout(warm, 2000);
    };

    if (document.readyState === 'complete') {
      idle();
    }
    else {
      this.on(window, 'load', idle, { once: true });
    }
  }

  handleOptionPreload(event) {
    const input = event.target.matches?.('input[data-option-value-id]')
      ? event.target
      : event.target.closest?.('label')?.control;

    if (!input || !input.matches('input[data-option-value-id]') || input.checked) return;

    const optionValues = this.optionContainers.map((container) => {
      if (container.contains(input)) return input.getAttribute('data-option-value-id');
      return container.querySelector('option[selected], input:checked')?.getAttribute('data-option-value-id');
    }).filter(Boolean);

    this.closest('product-info, product-card-info')?.preloadOptionValues?.(optionValues, input);
  }

  handleVariantChange(event) {
    const target = event.target;

    if (this.hasAttribute('data-dynamic-variants') && this.hasVariantData()) {
      this.syncCurrentOptions(target);
      this.findAndSetCurrentVariant(target);
      this.updateAvailableOptions(target);
    }

    this.markSelectedOption(target);
    this.publishSelectionChange(event, this.getActualInput(target));
  }

  markSelectedOption(target) {
    if (target.tagName === 'SELECT' && target.selectedOptions.length) {
      Array.from(target.options).find((opt) => opt.hasAttribute('selected'))?.removeAttribute('selected');
      target.selectedOptions[0].setAttribute('selected', '');
    }
  }

  getActualInput(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }

  hasVariantData() {
    return this.querySelector('[data-variants]') !== null;
  }

  getVariantData() {
    if (this.cachedVariantData) return this.cachedVariantData;

    const data = this.querySelector('[data-variants]')?.textContent;
    return this.cachedVariantData = data ? JSON.parse(data) : [];
  }

  findAndSetCurrentVariant(target) {
    this.currentVariant = this.findVariantByOptions(true) ||
      this.findClosestAvailableVariant(target) ||
      this.findVariantByOptions(false) ||
      null;
  }

  findVariantByOptions(requireAvailability) {
    return this.getVariantData().find((variant) => {
      const matches = this.currentOptions.every((val, i) => variant[`option${i + 1}`] === val);
      return requireAvailability ? matches && variant.available : matches;
    });
  }

  findClosestAvailableVariant(lastSelectedOption) {
    if (!lastSelectedOption) return null;

    const lastIndex = parseInt(lastSelectedOption.getAttribute('data-option-index'));
    const matches = this.getVariantData().filter((variant) =>
      variant.available &&
      this.currentOptions.slice(0, lastIndex).every((val, i) => variant[`option${i + 1}`] === val)
    );

    return matches.reduce((best, variant) => {
      if (!best) return variant;
      const bestScore = this.currentOptions.reduce((sum, val, i) =>
        best[`option${i + 1}`] === val ? sum + (3 - i) : sum, 0);
      const currentScore = this.currentOptions.reduce((sum, val, i) =>
        variant[`option${i + 1}`] === val ? sum + (3 - i) : sum, 0);
      return currentScore > bestScore ? variant : best;
    }, null);
  }

  syncCurrentOptions(target) {
    this.currentOptions = Array.from(this.querySelectorAll('select, fieldset')).map((el) => {
      if (el.tagName === 'SELECT') return el.value;
      return Array.from(el.querySelectorAll('input')).find((radio) =>
        radio === target || radio.checked
      )?.value;
    });
  }

  updateAvailableOptions(lastSelectedOption) {
    const firstValue = this.querySelector(':checked')?.value;
    if (!firstValue) return;

    const matchingVariants = this.getVariantData().filter((v) => v.option1 === firstValue);
    const groups = [...this.querySelectorAll('fieldset, .variant-wrapper')];

    groups.forEach((group, i) => {
      if (i === 0 || lastSelectedOption.parentElement === group) return;

      const inputs = [...group.querySelectorAll('input[type="radio"], option')];
      const prevValue = groups[i - 1].querySelector(':checked')?.value;

      const available = matchingVariants
        .filter((v) => v.available && v[`option${i}`] === prevValue)
        .map((v) => v[`option${i + 1}`]);

      this.setInputStates(inputs, available);
    });
  }

  setInputStates(inputs, availableValues) {
    inputs.forEach((input) => {
      const index = input.getAttribute('data-option-index');
      const value = input.getAttribute('value');
      const isAvailable = availableValues.includes(value);
      const isCurrent = this.currentVariant?.[`option${index}`] === value;

      if (input.tagName === 'INPUT') {
        input.classList.toggle('disabled', !isAvailable);
        if (isCurrent) input.checked = true;
      } else {
        isCurrent ? input.setAttribute('selected', '') : input.removeAttribute('selected');
      }
    });
  }

  publishSelectionChange(event, target) {
    theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.optionValueSelectionChange, {
      data: { event, target, selectedOptionValues: this.selectedOptionValues }
    });
  }
}
customElements.define('variant-picker', VariantPicker);

const cachedProductInfo = new Map();
const PRODUCT_INFO_CACHE_LIMIT = 50;
const warmedGalleryUrls = new Set();

class ProductInfo extends BaseElement {
  pendingRequestUrl = null;
  preProcessHtmlCallbacks = [];
  postProcessHtmlCallbacks = [];

  get sectionId() {
    return this.hasAttribute('data-original-section-id') ? this.getAttribute('data-original-section-id') : this.getAttribute('data-section-id');
  }

  get productId() {
    return this.getAttribute('data-product-id');
  }

  get productForm() {
    return document.forms[this.getAttribute('form')];
  }

  get productStickyForm() {
    return document.getElementById(`ProductStickyForm-${this.sectionId}-${this.productId}`);
  }

  get pickupAvailability() {
    return this.querySelector('pickup-availability');
  }

  get variantSelectors() {
    return this.querySelector('variant-picker');
  }

  get quantityInput() {
    return this.querySelector('quantity-input input');
  }

  connectedCallback() {
    super.connectedCallback();

    this.initProductAnimation();

    const variantChangeUnsubscriber = theme.pubsub.subscribe(
      theme.pubsub.PUB_SUB_EVENTS.optionValueSelectionChange,
      this.handleOptionValueChange.bind(this)
    );
    this.registerCleanup(variantChangeUnsubscriber);

    this.initQuantityHandlers();
    this.dispatchEvent(new CustomEvent('product-info:loaded', { bubbles: true }));
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.renderAbortController?.abort();
  }

  initProductAnimation() {
    if (theme.config.motionReduced) return;

    this.animation = new theme.Animation(this);
    this.animation.beforeLoad();

    Motion.inView(this, async () => {
      if (!this.immediate && this.media) await theme.utils.imageLoaded(this.media);
      this.animation.load();
    });
  }

  handleOptionValueChange({ data: { event, target, selectedOptionValues } }) {
    if (!this.contains(event.target)) return;

    this.resetProductFormState();

    const productUrl = target.getAttribute('data-product-url') || this.pendingRequestUrl || this.getAttribute('data-product-url');
    this.pendingRequestUrl = productUrl;
    const shouldSwapProduct = this.getAttribute('data-product-url') !== productUrl;

    if (shouldSwapProduct) {
      window.location.href = productUrl;
      return;
    }

    this.renderProductInfo({
      requestUrl: this.buildRequestUrlWithParams(productUrl, selectedOptionValues),
      targetId: target.tagName === 'OPTION' ? target.parentElement.id : target.id,
      callback: this.handleUpdateProductInfo()
    });
  }

  resetProductFormState() {
    this.productForm?.handleErrorMessage();
    this.productForm?.toggleSubmitButton(true, '');
    this.productStickyForm?.handleErrorMessage();
    this.productStickyForm?.toggleSubmitButton(true, '');
  }

  preloadOptionValues(selectedOptionValues, target) {
    if (!selectedOptionValues.length) return;

    const productUrl = target.getAttribute('data-product-url') || this.getAttribute('data-product-url');
    if (this.getAttribute('data-product-url') !== productUrl) return; // different product => full navigation, nothing to preload

    const requestUrl = this.buildRequestUrlWithParams(productUrl, selectedOptionValues);
    const requestPromise = this.getProductInfoHTML(requestUrl);

    // Warm the variant's featured image so the later swap is instant. Once per URL.
    if (!warmedGalleryUrls.has(requestUrl)) {
      warmedGalleryUrls.add(requestUrl);
      requestPromise.then((responseText) => this.warmGalleryFeaturedImage(responseText)).catch(() => { });
    }
  }

  getProductInfoHTML(requestUrl) {
    if (cachedProductInfo.has(requestUrl)) {
      return cachedProductInfo.get(requestUrl);
    }

    const requestPromise = fetch(requestUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Variant render failed with status ${response.status}`);
        return response.text();
      })
      .catch((error) => {
        cachedProductInfo.delete(requestUrl);
        throw error;
      });

    cachedProductInfo.set(requestUrl, requestPromise);

    if (cachedProductInfo.size > PRODUCT_INFO_CACHE_LIMIT) {
      cachedProductInfo.delete(cachedProductInfo.keys().next().value);
    }

    return requestPromise;
  }

  renderProductInfo({ requestUrl, targetId, callback }) {
    this.renderAbortController?.abort();
    this.renderAbortController = new AbortController();
    const { signal } = this.renderAbortController;

    this.getProductInfoHTML(requestUrl)
      .then((responseText) => {
        if (signal.aborted) return;

        this.pendingRequestUrl = null;

        if (callback !== undefined) {
          const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
          callback(parsedHTML, requestUrl);
        }

        const activeElement = document.getElementById(targetId);
        if (activeElement === null) return;

        if (activeElement.hasAttribute('align-selected')) {
          const scrollElement = activeElement.closest(activeElement.getAttribute('align-selected'));
          scrollElement?.scrollTo({
            left: activeElement.offsetLeft,
            behavior: 'instant'
          });
        }
        setTimeout(() => {
          activeElement.focus({ preventScroll: true });
        }, 100);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') console.error(error);
      });
  }

  buildRequestUrlWithParams(url, optionValues) {
    const params = [];
    params.push(`section_id=${this.sectionId}`);

    if (optionValues.length) {
      params.push(`option_values=${optionValues.join(',')}`);
    }

    return `${url}?${params.join('&')}`;
  }

  handleUpdateProductInfo() {
    return (parsedHTML, requestUrl) => {
      const variant = this.getSelectedVariant(parsedHTML);

      this.pickupAvailability?.update(variant);
      this.updateOptionValues(parsedHTML);
      this.updateURL(variant);
      this.updateVariantInputs(variant);

      if (!variant) {
        if (requestUrl) cachedProductInfo.delete(requestUrl);
        this.setUnavailable();
        return;
      }

      this.updateGalleryFromDestination(parsedHTML);
      this.updateSourceFromDestination(parsedHTML, 'Price');
      this.updateSourceFromDestination(parsedHTML, 'BuyButtonPrice');
      this.updateSourceFromDestination(parsedHTML, 'StickyPrice');
      this.updateSourceFromDestination(parsedHTML, 'Sku');
      this.updateSourceFromDestination(parsedHTML, 'Badges');
      this.updateSourceFromDestination(parsedHTML, 'Inventory');
      this.updateSourceFromDestination(parsedHTML, 'Volume');
      this.updateSourceFromDestination(parsedHTML, 'PricePerItem');
      this.updateSourceFromDestination(parsedHTML, 'BackInStock');
      this.updateSourceFromDestination(parsedHTML, 'ProductBundle');

      this.updateQuantityRules(parsedHTML);
      this.updateSourceFromDestination(parsedHTML, 'QuantityRules');
      this.updateSourceFromDestination(parsedHTML, 'QuantityRulesCart');
      this.updateSourceFromDestination(parsedHTML, 'VolumeNote');

      this.productForm?.toggleSubmitButton(!variant.available, theme.variantStrings.soldOut);
      this.productStickyForm?.toggleSubmitButton(!variant.available, theme.variantStrings.soldOut);

      theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.variantChange, {
        data: {
          sectionId: this.sectionId,
          productId: this.productId,
          parsedHTML: parsedHTML,
          variant: variant
        }
      });

      (this.productForm ?? document).dispatchEvent(new CustomEvent('variant:change', {
        detail: {
          variant: variant
        }
      }));
    };
  }

  getSelectedVariant(productInfoNode) {
    const selectedVariant = productInfoNode.querySelector('[data-selected-variant]')?.textContent;
    return !!selectedVariant ? JSON.parse(selectedVariant) : null;
  }

  updateOptionValues(parsedHTML) {
    const variantPicker = parsedHTML.getElementById(`VariantPicker-${this.sectionId}-${this.productId}`);
    if (variantPicker) {
      theme.HTMLUpdateUtility.viewTransition(this.variantSelectors, variantPicker, this.preProcessHtmlCallbacks);
    }
  }

  updateURL(variant) {
    const variantId = variant?.id;
    if (!variantId || this.getAttribute('data-update-url') === 'false') return;

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('variant', variantId);
    window.history.replaceState({ path: newUrl.toString() }, '', newUrl.toString());
  }

  updateVariantInputs(variant) {
    const variantId = variant?.id;
    if (!variantId) return;

    const productForms = document.querySelectorAll(`#ProductForm-${this.sectionId}-${this.productId}, #ProductFormInstallment-${this.sectionId}-${this.productId}`);
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = variantId ?? '';
      input.setAttribute('data-min', variant.quantity_rule?.min || 1);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  updateSourceFromDestination(parsedHTML, id) {
    const source = parsedHTML.getElementById(`${id}-${this.sectionId}-${this.productId}`);
    const destination = document.querySelector(`#${id}-${this.sectionId}-${this.productId}`);
    if (source && destination) {
      destination.innerHTML = source.innerHTML;
      destination.removeAttribute('hidden');
    }
  }

  get gallerySourceSectionId() {
    return this.sectionId;
  }

  updateGalleryFromDestination(parsedHTML) {
    const source = parsedHTML.getElementById(`ProductGallery-${this.gallerySourceSectionId}-${this.productId}`);
    const destination = document.querySelector(`#ProductGallery-${this.sectionId}-${this.productId}`);
    if (!source || !destination) return;

    const signal = this.renderAbortController?.signal;

    const swap = () => {
      if (signal?.aborted) return;
      destination.removeAttribute('aria-busy');

      if (source.className && destination.className !== source.className) {
        destination.className = source.className;
      }

      if (this.morphGalleryMedia(source, destination)) {
        const slider = destination.sliderGallery;
        if (slider) {
          slider.reset?.();
          slider.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        }
      }
      else {
        destination.innerHTML = source.innerHTML;
      }
      destination.removeAttribute('hidden');
      destination.countMediaGallery?.();
    };

    // Hold the current gallery until the new image decodes — no skeleton flash on slow networks.
    const featuredItem = source.querySelector('[data-media-id]');
    const featuredImg = featuredItem?.querySelector('img');
    if (!featuredImg) return swap();

    const existingImg = destination.querySelector(`[data-media-id="${featuredItem.getAttribute('data-media-id')}"] img`);
    if (existingImg?.complete && existingImg.naturalWidth > 0) return swap();

    destination.setAttribute('aria-busy', 'true');

    const loader = new Image();
    loader.fetchPriority = 'high';
    loader.sizes = featuredImg.getAttribute('sizes') || '';
    loader.srcset = featuredImg.getAttribute('srcset') || '';
    loader.src = featuredImg.getAttribute('src') || '';

    Promise.race([
      loader.decode().catch(() => { }),
      new Promise((resolve) => setTimeout(resolve, 3000)) // cap the wait — degrade to the old swap-then-load behavior
    ]).then(swap);
  }

  // Keyed reconciliation of gallery media: shared nodes are MOVED (state survives), not re-created.
  // Returns false if structures don't line up — caller does a full swap.
  morphGalleryMedia(source, destination) {
    const listsOf = (root) => {
      const parents = [];
      root.querySelectorAll('[data-media-id]').forEach((item) => {
        if (!parents.includes(item.parentElement)) parents.push(item.parentElement);
      });
      return parents;
    };

    const sourceLists = listsOf(source);
    const destinationLists = listsOf(destination);
    if (!sourceLists.length || sourceLists.length !== destinationLists.length) return false;

    const pairs = [];
    for (let i = 0; i < sourceLists.length; i++) {
      const sourceList = sourceLists[i];
      const destinationList = destinationLists[i];
      if (sourceList.tagName !== destinationList.tagName) return false;

      // thumbnails/dots binds index + listeners once at init — swap it whole to re-init fresh.
      const sourceDots = sourceList.closest('media-dots');
      const destinationDots = destinationList.closest('media-dots');
      if (!!sourceDots !== !!destinationDots) return false;
      pairs.push(sourceDots ? { oldDots: destinationDots, newDots: sourceDots } : { sourceList, destinationList });
    }

    pairs.forEach((pair) => {
      if (pair.newDots) {
        if (pair.oldDots.isConnected) pair.oldDots.replaceWith(pair.newDots);
        return;
      }

      const { sourceList, destinationList } = pair;
      const before = Array.from(destinationList.children);
      const keyed = new Map();
      before.forEach((child) => {
        const id = child.getAttribute?.('data-media-id');
        if (id) keyed.set(id, child);
      });

      const after = Array.from(sourceList.children).map((newChild) => {
        const id = newChild.getAttribute?.('data-media-id');
        const existing = id ? keyed.get(id) : null;
        if (existing) {
          Array.from(existing.attributes).forEach((attr) => {
            if (!newChild.hasAttribute(attr.name)) existing.removeAttribute(attr.name);
          });
          Array.from(newChild.attributes).forEach((attr) => {
            if (existing.getAttribute(attr.name) !== attr.value) existing.setAttribute(attr.name, attr.value);
          });
          return existing;
        }
        return newChild;
      });

      // Same nodes in the same order: skip the disconnect/reconnect churn entirely.
      if (after.length === before.length && after.every((node, index) => node === before[index])) return;

      destinationList.replaceChildren(...after);
    });

    return true;
  }

  warmGalleryFeaturedImage(responseText) {
    const connection = navigator.connection;
    if (connection && (connection.saveData || /2g/.test(connection.effectiveType || ''))) return;

    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
    const img = parsedHTML.getElementById(`ProductGallery-${this.gallerySourceSectionId}-${this.productId}`)?.querySelector('[data-media-id] img');
    if (!img || !img.getAttribute('src')) return;

    const loader = new Image();
    loader.fetchPriority = 'low';
    loader.sizes = img.getAttribute('sizes') || '';
    loader.srcset = img.getAttribute('srcset') || '';
    loader.src = img.getAttribute('src');
  }

  setUnavailable() {
    // A previous switch may have left the gallery dimmed while waiting on decode.
    document.querySelector(`#ProductGallery-${this.sectionId}-${this.productId}`)?.removeAttribute('aria-busy');

    this.productForm?.toggleSubmitButton(true, theme.variantStrings.unavailable, true);
    this.productStickyForm?.toggleSubmitButton(true, theme.variantStrings.unavailable, true);

    const selectors = ['Price', 'BuyButtonPrice', 'StickyPrice', 'Inventory', 'Sku', 'Badges', 'PricePerItem', 'BackInStock', 'ProductBundle', 'VolumeNote', 'Volume', 'QuantityRules', 'QuantityRulesCart']
      .map((id) => `#${id}-${this.sectionId}-${this.productId}`)
      .join(', ');
    document.querySelectorAll(selectors).forEach((selector) => selector.setAttribute('hidden', ''));
  }

  initQuantityHandlers() {
    if (!this.quantityInput) return;

    this.setQuantityBoundries();
    if (!this.hasAttribute('data-original-section-id')) {
      const cartUpdateUnsubscriber = theme.pubsub.subscribe(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, this.fetchQuantityRules.bind(this));
      this.registerCleanup(cartUpdateUnsubscriber);
    }
  }

  setQuantityBoundries() {
    theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.quantityBoundries, {
      data: {
        sectionId: this.sectionId,
        productId: this.productId
      }
    });
  }

  fetchQuantityRules() {
    const currentVariantId = this.productForm?.variantIdInput?.value;
    if (!currentVariantId) return;

    this.querySelector('label[is="quantity-label"]')?.setAttribute('aria-busy', 'true');
    fetch(`${this.getAttribute('data-product-url')}?variant=${currentVariantId}&section_id=${this.sectionId}`)
      .then((response) => response.text())
      .then((responseText) => {
        const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
        this.updateQuantityRules(parsedHTML);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        this.querySelector('label[is="quantity-label"]')?.removeAttribute('aria-busy');
      });
  }

  updateQuantityRules(parsedHTML) {
    if (!this.quantityInput) return;

    theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.quantityRules, {
      data: {
        sectionId: this.sectionId,
        productId: this.productId,
        parsedHTML
      }
    });

    this.setQuantityBoundries();
  }
}
customElements.define('product-info', ProductInfo);

class ProductForm extends BaseElementMixin(HTMLFormElement) {
  connectedCallback() {
    super.connectedCallback();

    this.variantIdInput.disabled = false;
    this.on(this, 'submit', this.onSubmitHandler);
  }

  get cartDrawer() {
    return document.querySelector('cart-drawer');
  }

  get submitButton() {
    return this._submitButton = this._submitButton || this.querySelector('[type="submit"]');
  }

  get submitButtons() {
    return this._submitButtons = this._submitButtons || document.querySelectorAll(`[type="submit"][form="${this.getAttribute('id')}"]`);
  }

  get hideErrors() {
    return this.getAttribute('data-hide-errors') === 'true';
  }

  get variantIdInput() {
    return this.querySelector('[name="id"]');
  }

  get bundles() {
    return Array.from(document.querySelectorAll(`[form="${this.getAttribute('id')}"] input[name="bundles"]:checked`));
  }

  prepareFormData(formData) {
    const bundles = this.bundles;
    const bundlesLength = bundles.length;
    const itemsArray = new Array(bundlesLength + 1);

    for (let i = 0; i < bundlesLength; i++) {
      const reverseIndex = bundlesLength - 1 - i;
      const bundle = bundles[reverseIndex];
      itemsArray[i] = {
        id: bundle.value,
        quantity: bundle.getAttribute('data-min')
      };
    }

    const allFormData = { items: itemsArray.slice(0, bundlesLength) };

    const json = {};
    const formEntries = Array.from(formData.entries());

    for (const [name, value] of formEntries) {
      if (name === 'id' || name === 'quantity' || name.includes('properties')) {
        if (name === 'id' || name === 'quantity') {
          json[name] = value;
        } else {
          const regex = /(?:^(properties\[))(.*?)(?:\])/;
          const property = regex.exec(name)[2];
          json.properties = json.properties || {};
          json.properties[property] = value;
        }
      } else {
        allFormData[name] = value;
      }
    }

    allFormData.items.push(json);
    return allFormData;
  }

  onSubmitHandler(event) {
    const bundles = this.bundles;
    const bundlesLength = bundles.length;

    if (!Shopify.designMode) {
      if (document.body.classList.contains('template-cart') || theme.settings.cartType === 'page') {
        if (bundlesLength > 0) {
          theme.utils.postLink2(theme.routes.cart_add_url, {
            parameters: {
              ...this.prepareFormData(new FormData(this))
            }
          });
          event.preventDefault();
        }
        return;
      }
    }

    event.preventDefault();
    if (this.submitButton.hasAttribute('aria-disabled')) return;
    this.activeElement = event.submitter || event.currentTarget;

    this.handleErrorMessage();

    let sectionsToBundle = [];
    document.documentElement.dispatchEvent(new CustomEvent('cart:bundled-sections', { bubbles: true, detail: { sections: sectionsToBundle } }));

    const config = theme.utils.fetchConfig('javascript');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    delete config.headers['Content-Type'];

    const formData = new FormData(this);
    formData.append('sections', sectionsToBundle);
    formData.append('sections_url', window.location.pathname);

    config.body = formData;

    if (bundlesLength > 0) {
      const allFormData = this.prepareFormData(formData);
      config.body = JSON.stringify(allFormData);
      config.headers['Content-Type'] = 'application/json';
    }

    this.submitButton.setAttribute('aria-disabled', 'true');
    this.submitButton.setAttribute('aria-busy', 'true');

    fetch(theme.routes.cart_add_url, config)
      .then((response) => response.json())
      .then(async (parsedState) => {
        if (parsedState.status) {
          theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartError, {
            source: 'product-form',
            productVariantId: formData.get('id'),
            errors: parsedState.errors || parsedState.description,
            message: parsedState.message
          });
          this.handleErrorMessage(parsedState.description);
          document.dispatchEvent(new CustomEvent('ajaxProduct:error', {
            detail: {
              errorMessage: parsedState.description
            }
          }));

          const submitButtonText = this.submitButton.querySelector('.btn-text>span');
          if (submitButtonText && submitButtonText.hasAttribute('data-sold-out')) {
            submitButtonText.innerText = submitButtonText.getAttribute('data-sold-out');
            this.submitButton.setAttribute('aria-disabled', 'true');
            this.error = true;
          }

          const cartJson = await (await fetch(theme.routes.cart_url, { ...theme.utils.fetchConfig('json', 'GET') })).json();
          theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, { source: 'product-form', productVariantId: formData.get('id'), cart: cartJson });

          document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { open: false } }));
          return;
        }

        if (Shopify.designMode) {
          if (document.body.classList.contains('template-cart') || theme.settings.cartType === 'page') {
            window.location.href = theme.routes.cart_url;
            return;
          }
        }

        const cartJson = await (await fetch(theme.routes.cart_url, { ...theme.utils.fetchConfig('json', 'GET') })).json();
        cartJson['sections'] = parsedState['sections'];

        theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, { source: 'product-form', productVariantId: formData.get('id'), cart: cartJson });
        document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
          detail: {
            product: parsedState
          }
        }));

        this.cartDrawer?.show(this.activeElement);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        this.submitButton.removeAttribute('aria-busy');
        this.submitButtons.forEach(submitButton => submitButton.removeAttribute('aria-busy'));

        if (!this.error) {
          this.submitButton.removeAttribute('aria-disabled');
          this.submitButtons.forEach(submitButton => submitButton.removeAttribute('aria-disabled'));
        }
      });
  }

  handleErrorMessage(errorMessage = false) {
    if (this.hideErrors) return;

    this.errorMessage = this.errorMessage || this.querySelector('.product-form__error-message');
    if (!this.errorMessage) return;

    this.errorMessage.toggleAttribute('hidden', !errorMessage);
    this.errorMessage.innerText = errorMessage;
  }

  toggleSubmitButton(disable = true, text, unavailable = false) {
    if (!this.submitButton) return;

    this.submitButton.removeAttribute('loading');
    this.submitButton.removeAttribute('unavailable');

    // Variant re-evaluated: release the sold-out latch left by a failed add-to-cart.
    this.error = false;
    this.submitButton.removeAttribute('aria-disabled');
    this.submitButtons.forEach((submitButton) => submitButton.removeAttribute('aria-disabled'));

    const submitButtonText = this.submitButton.querySelector('.btn-text');
    const submitButtonTextChild = this.submitButton.querySelector('.btn-text>span');

    if (disable) {
      this.submitButton.setAttribute('disabled', '');
      if (unavailable) this.submitButton.setAttribute('unavailable', '');
      if (text) {
        (submitButtonTextChild || submitButtonText).textContent = text;
      }
      else {
        this.submitButton.setAttribute('loading', '');
      }
    }
    else {
      this.submitButton.removeAttribute('disabled');
      (submitButtonTextChild || submitButtonText).textContent = this.submitButton.hasAttribute('data-pre-order') ? theme.variantStrings.preOrder : theme.variantStrings.addToCart;
    }
  }
}
customElements.define('product-form', ProductForm, { extends: 'form' });

class ProductStickyForm extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.onVariantChangedListener = this.onVariantChangedListener || this.onVariantChanged.bind(this);
    this.on(this.productForm ?? document, 'variant:change', this.onVariantChangedListener);

    this.scopeFrom = document.querySelector('.quick-order-list') || document.getElementById(this.getAttribute('form'));
    this.scopeTo = document.querySelector('.footer-group');

    if (!this.scopeFrom || !this.scopeTo) {
      return;
    }

    const intersectionObserver = new IntersectionObserver(this.handleIntersection.bind(this));
    intersectionObserver.observe(this.scopeFrom);
    intersectionObserver.observe(this.scopeTo);
    this.registerCleanup(() => intersectionObserver.disconnect());
  }

  get productForm() {
    return document.forms[this.getAttribute('form')];
  }

  get submitButton() {
    return this._submitButton = this._submitButton || this.querySelector('[type="submit"]');
  }

  get productOptions() {
    return this._productOptions = this._productOptions || this.querySelector('[data-sticky-product-options]');
  }

  get productMedia() {
    return this._productMedia = this._productMedia || this.querySelector('[data-sticky-product-media]');
  }

  handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.target === this.scopeFrom) {
        this.scopeFromPassed = entry.boundingClientRect.bottom < 0;
      }
      if (entry.target === this.scopeTo) {
        this.scopeToReached = entry.isIntersecting;
      }
    });

    if (this.scopeFromPassed && !this.scopeToReached) {
      Motion.animate(this.firstElementChild, { opacity: 1, visibility: 'visible', transform: ['translateY(15px)', 'translateY(0)'] }, { duration: 1, easing: [0.16, 1, 0.3, 1] });
    }
    else {
      Motion.animate(this.firstElementChild, { opacity: 0, visibility: 'hidden', transform: ['translateY(0)', 'translateY(15px)'] }, { duration: 1, easing: [0.16, 1, 0.3, 1] });
    }
  }

  onVariantChanged(event) {
    this.updateProductMedia(event.detail.variant);
    this.updateProductOptions(event.detail.variant);
  }

  updateProductMedia(currentVariant) {
    if (!currentVariant || !currentVariant.featured_media) return;

    const image = this.productMedia.querySelector('img');
    const newImage = new Image(currentVariant.featured_media.preview_image.width, currentVariant.featured_media.preview_image.height);

    newImage.alt = currentVariant.featured_media.alt;
    newImage.src = currentVariant.featured_media.preview_image.src;
    newImage.srcset = this.generateSrcset(currentVariant.featured_media.preview_image);
    newImage.sizes = image.sizes;

    this.productMedia.replaceChildren(newImage);
  }

  updateProductOptions(currentVariant) {
    if (!currentVariant) return;

    this.productOptions.innerText = currentVariant.title;
  }

  handleErrorMessage(errorMessage = false) {
    if (this.productForm?.hideErrors) return;

    this.errorMessage = this.errorMessage || this.querySelector('.product-form__error-message');
    if (!this.errorMessage) return;

    this.errorMessage.toggleAttribute('hidden', !errorMessage);
    this.errorMessage.innerText = errorMessage;
  }

  toggleSubmitButton(disable = true, text) {
    if (!this.submitButton) return;

    const submitButtonText = this.submitButton.querySelector('.btn-text');
    const submitButtonTextChild = this.submitButton.querySelector('.btn-text>span');

    if (disable) {
      this.submitButton.setAttribute('disabled', '');
      if (text) {
        (submitButtonTextChild || submitButtonText).textContent = text;
      }
    }
    else {
      this.submitButton.removeAttribute('disabled');
      (submitButtonTextChild || submitButtonText).textContent = this.submitButton.hasAttribute('data-pre-order') ? theme.variantStrings.preOrder : theme.variantStrings.addToCart;
    }
  }

  generateSrcset(image) {
    const widths = this.productMedia.getAttribute('data-widths').split(',').map((width) => parseInt(width));
    return widths.filter((width) => width <= image.width).map((width) => {
      return `${image.src}&width=${width} ${width}w`;
    }).join(', ');
  }
}
customElements.define('product-sticky-form', ProductStickyForm);

class ProductBundleDetails extends AccordionDetails {

  get productForm() {
    return document.forms[this.getAttribute('form')];
  }

  get bundles() {
    return Array.from(this.querySelectorAll('input[name="bundles"]:checked'));
  }

  connectedCallback() {
    super.connectedCallback();

    const cartUpdateUnsubscriber = theme.pubsub.subscribe(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, this.onCartUpdate.bind(this));
    this.registerCleanup(cartUpdateUnsubscriber);
    this.onBundleChangeListener = this.onBundleChange.bind(this);
    this.on(this, 'change', this.onBundleChangeListener);
  }

  onCartUpdate(event) {
    const bundles = this.bundles;
    const bundlesLength = bundles.length;

    if (bundlesLength === 0) return;

    if (event.source === 'product-form') {
      bundles.forEach((input) => {
        if (!input.disabled) input.checked = false;
      });
      this.onBundleChange();
    }
  }

  onBundleChange() {
    (this.productForm ?? document).dispatchEvent(new CustomEvent('bundle:change', {
      detail: {
        items: this.bundles.map(input => ({
          id: input.value,
          quantity: input.getAttribute('data-min'),
          price: input.getAttribute('data-price')
        }))
      }
    }));
  }
}
customElements.define('product-bundle-details', ProductBundleDetails, { extends: 'details' });

class ProductBundlePicker extends BaseElementMixin(HTMLLabelElement) {
  constructor() {
    super();
    this.handleVariantChange = this.handleVariantChange.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'change', this.handleVariantChange);
  }

  handleVariantChange(event) {
    const target = event.target;

    if (target.tagName !== 'SELECT') return;

    const option = target.selectedOptions?.[0];
    if (!option) return;

    const value = option.value;
    const price = option.getAttribute('data-price');
    const min = option.getAttribute('data-min');
    const imgSrc = option.getAttribute('data-img-src');
    const imgSrcset = option.getAttribute('data-img-srcset');

    this.updateCheckboxInput(value, price, min);
    this.updatePrice(price);
    this.updateImage(imgSrc, imgSrcset);
  }

  updateCheckboxInput(value, price, min) {
    const input = this.querySelector('input[type="checkbox"]');
    if (!input) return;

    input.value = value;
    input.setAttribute('data-price', price);
    input.setAttribute('data-min', min);
  }

  updatePrice(price) {
    const priceElement = this.querySelector('.price__regular');
    if (!priceElement || !price) return;

    const format = theme.settings.currencyCodeEnabled
      ? theme.settings.moneyWithCurrencyFormat
      : theme.settings.moneyFormat;

    priceElement.innerHTML = theme.Currency.formatMoney(price, format);
  }

  updateImage(src, srcset) {
    const img = this.querySelector('img');
    if (!img) return;

    if (src) img.src = src;
    if (srcset) img.srcset = srcset;
  }
}
customElements.define('product-bundle-picker', ProductBundlePicker, { extends: 'label' });

class ProductBuyPrice extends BaseElement {
  constructor() {
    super();
    this.onBundleChangedListener = this.onBundleChanged.bind(this);
  }

  get productForm() {
    const formId = this.getAttribute('form');
    return formId ? document.forms[formId] : null;
  }

  get basePrice() {
    return parseInt(this.getAttribute('data-price')) || 0;
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this.productForm ?? document, 'bundle:change', this.onBundleChangedListener);
  }

  onBundleChanged(event) {
    const { items } = event.detail;

    const subtotal = items.reduce((total, item) => {
      const price = parseInt(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return total + (price * quantity);
    }, this.basePrice);

    this.updatePrice(subtotal);
  }

  updatePrice(amount) {
    const format = theme.settings.currencyCodeEnabled
      ? theme.settings.moneyWithCurrencyFormat
      : theme.settings.moneyFormat;

    this.innerHTML = theme.Currency.formatMoney(amount, format);
  }

}
customElements.define('product-buy-price', ProductBuyPrice);

class MediaGallery extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, () => {
      requestAnimationFrame(() => {
        this.pauseAllMedia();
        this.preloadAdjacentMedia();
      });
      //setTimeout(() => this.pauseAllMedia(), 500);
    });
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this.productForm ?? document, 'variant:change', this.onVariantChanged.bind(this));

    this.on(this, 'lightbox:open', (event) => this.openZoom(event.detail.index));
    this.on(this.sliderGallery, 'slider:change', this.onSlideChange.bind(this));

    // Keep the same slide across resizes, since slide widths change by breakpoint.
    this.lastViewportWidth = window.innerWidth;
    this.on(window, 'resize', this.onWindowResize.bind(this));

    this.registerCleanup(() => {
      this._photoswipe?.destroy?.();
      this._photoswipe = null;
    });
    this.registerCleanup(() => clearTimeout(this.resizeSettleTimer));

    this.countMediaGallery();
  }

  onWindowResize() {
    // Ignore height-only resizes to avoid interrupting active swipes.
    if (window.innerWidth === this.lastViewportWidth) return;
    this.lastViewportWidth = window.innerWidth;

    // Capture the current slide before reflow updates currentPage.
    if (!this.resizeActiveItem) {
      const slider = this.sliderGallery;
      this.resizeActiveItem = slider?.itemsToShow?.[(slider.currentPage || 1) - 1] || null;
    }

    clearTimeout(this.resizeSettleTimer);
    this.resizeSettleTimer = setTimeout(() => {
      const item = this.resizeActiveItem;
      this.resizeActiveItem = null;
      if (!item || !item.isConnected || item.clientWidth === 0) return;

      const slider = this.sliderGallery;
      const first = slider.itemsToShow[0];
      if (!first) return;

      // Use absolute scroll so currentPage stays in sync, even when no scroll event fires.
      slider.scrollTo({ left: item.offsetLeft - first.offsetLeft, behavior: 'instant' });
    }, 200);
  }

  get viewInSpaceButton() {
    return this.querySelector('[data-shopify-xr]');
  }

  get productForm() {
    return document.forms[this.getAttribute('form')];
  }

  get sliderGallery() {
    return this.querySelector('slider-element');
  }

  get mediaPreview() {
    return this.querySelector('.product__preview .product__media');
  }

  get photoswipe() {
    if (this._photoswipe) return this._photoswipe;

    const lightbox = new PhotoSwipeLightbox({
      arrowPrevSVG: '<svg class="pswp__icn icon" stroke="currentColor" fill="none" viewBox="0 0 30 30"><path d="M17.5 7.5L10 15L17.5 22.5"/></svg>',
      arrowNextSVG: '<svg class="pswp__icn icon" stroke="currentColor" fill="none" viewBox="0 0 30 30"><path d="M17.5 7.5L10 15L17.5 22.5"/></svg>',
      closeSVG: '<svg class="pswp__icn icon" stroke="currentColor" fill="none" viewBox="0 0 30 30"><path d="m7.5 22.5 15-15m-15 0 15 15"/></svg>',
      bgOpacity: 1,
      pswpModule: () => import(theme.settings.pswpModule),

      arrowPrevTitle: theme.strings.previous,
      arrowNextTitle: theme.strings.next,
      closeTitle: theme.strings.close,

      // Recommended options for this plugin
      allowPanToNext: false,
      allowMouseDrag: true,
      wheelToZoom: false,
      returnFocus: true,
      zoom: false,
    });

    lightbox.addFilter('thumbEl', (_thumbEl, data) => data['thumbnailElement']);

    lightbox.on('contentLoad', (event) => {
      const { content } = event;

      if (content.type === 'video' || content.type === 'external_video' || content.type === 'model') {
        event.preventDefault();

        // Create a container for video and assign it to the `content.element` property
        content.element = document.createElement('div');
        content.element.className = 'pswp__video-container';
        content.element.appendChild(content.data.domElement.cloneNode(true));
      }
    });

    lightbox.on('change', () => {
      this.sliderGallery.select(lightbox.pswp.currIndex + 1, true);
    });

    lightbox.on('close', () => {
      const slideSelected = this.sliderGallery.selected(lightbox.pswp.currIndex);
      lightbox.pswp._lastActiveElement = slideSelected ? slideSelected.querySelector('button') : document.activeElement;
    });

    lightbox.init();
    return this._photoswipe = lightbox;
  }

  onVariantChanged(event) {
    const currentVariant = event.detail.variant;
    if (!currentVariant.featured_media) return;

    this.countMediaGallery();
    //this.setActiveMedia(currentVariant.featured_media.id);
  }

  onSlideChange(event) {
    const activeMedia = event.detail.currentElement;
    this.playActiveMedia(activeMedia);
    this.preloadAdjacentMedia(event.detail.currentPage);

    if (this.viewInSpaceButton) {
      if (activeMedia.getAttribute('data-media-type') === 'model') {
        this.viewInSpaceButton.setAttribute('data-shopify-model3d-id', activeMedia.getAttribute('data-media-id'));
      } else {
        this.viewInSpaceButton.setAttribute('data-shopify-model3d-id', this.viewInSpaceButton.getAttribute('data-shopify-model3d-default-id'));
      }
    }
  }

  setActiveMedia(mediaId) {
    let activeMedia = this.sliderGallery.querySelector(`[data-media-id="${mediaId}"]`);
    if (activeMedia?.checkVisibility() === false) {
      activeMedia = activeMedia.nextElementSibling;
    }
    if (activeMedia === null) return;

    activeMedia.scrollIntoView({
      block: 'start',
      behavior: theme.config.motionReduced ? 'auto' : 'smooth'
    });
  }

  playActiveMedia(activeMedia) {
    if (typeof activeMedia === 'undefined') return;

    const deferredMedia = activeMedia.querySelector('.deferred-media');

    this.sliderGallery.querySelectorAll('.deferred-media').forEach((media) => {
      deferredMedia === media ? media.play() : media.pause();
    });
  }

  preloadAdjacentMedia(currentPage = 1) {
    const items = this.sliderGallery.itemsToShow;
    const currentIndex = currentPage - 1;

    [items[currentIndex - 1], items[currentIndex + 1]].forEach((media) => {
      media?.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach((el) => el.removeAttribute('loading'));
    });
  }

  pauseAllMedia() {
    this.sliderGallery.querySelectorAll('[data-media-id]').forEach((media, index) => {
      if (index > 0) {
        const deferredMedia = media.querySelector('.deferred-media');
        if (deferredMedia && typeof deferredMedia.pause === 'function') deferredMedia.pause();
      }
    });
  }

  openZoom(index = 0) {
    let dataSource = this.sliderGallery.itemsToShow.map((media) => {
      const image = media.querySelector('img');

      if (media.getAttribute('data-media-type') === 'image') {
        return {
          thumbnailElement: image,
          src: image.src,
          srcset: image.srcset,
          msrc: image.currentSrc || image.src,
          width: parseInt(image.getAttribute('width')),
          height: parseInt(image.getAttribute('height')),
          alt: image.alt,
          thumbCropped: true
        };
      }

      if (media.getAttribute('data-media-type') === 'video' || media.getAttribute('data-media-type') === 'external_video' || media.getAttribute('data-media-type') === 'model') {
        const video = media.querySelector('.deferred-media');
        return {
          thumbnailElement: image,
          domElement: video,
          type: media.getAttribute('data-media-type'),
          src: image.src,
          srcset: image.srcset,
          msrc: image.currentSrc || image.src,
          width: 800,
          height: 800 / video.getAttribute('data-aspect-ratio'),
          alt: image.alt,
          thumbCropped: true
        };
      }
    });

    if (this.mediaPreview && this.mediaPreview.offsetParent) {
      if (this.mediaPreview.getAttribute('data-media-type') === 'image') {
        const image = this.mediaPreview.querySelector('img');
        dataSource.push({
          thumbnailElement: image,
          src: image.src,
          srcset: image.srcset,
          msrc: image.currentSrc || image.src,
          width: parseInt(image.getAttribute('width')),
          height: parseInt(image.getAttribute('height')),
          alt: image.alt,
          thumbCropped: true
        });

        if (index === -1) {
          index = dataSource.length - 1;
        }
      }
    }

    this.photoswipe.loadAndOpen(index, dataSource);
  }

  countMediaGallery() {
    let mediaCount = 0;
    this.sliderGallery.querySelectorAll('[data-media-id]').forEach((media) => {
      if (!media.classList.contains('xl:hidden') && !media.hasAttribute('hidden')) {
        mediaCount++;
      }
    });

    if (this.mediaPreview) {
      mediaCount++;
    }

    mediaCount > 1 ? this.classList.remove('with-only1') : this.classList.add('with-only1');
  }
}
customElements.define('media-gallery', MediaGallery);

class MediaLightboxButton extends BaseElementMixin(HTMLButtonElement) {
  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'click', this.onButtonClick);
  }

  onButtonClick() {
    const media = this.closest('[data-media-id]');
    const sliderGallery = this.closest('slider-element');
    const openIndex = sliderGallery ? sliderGallery.itemsToShow.indexOf(media) : -1;

    this.dispatchEvent(new CustomEvent('lightbox:open', {
      bubbles: true,
      detail: {
        index: openIndex
      }
    }));
  }
}
customElements.define('media-lightbox-button', MediaLightboxButton, { extends: 'button' });

class MediaHoverButton extends MediaLightboxButton {

  get zoomRatio() {
    return 2;
  }

  onButtonClick(event) {
    if (theme.config.isTouch) {
      super.onButtonClick();
    }
    else {
      const media = this.closest('[data-media-type="image"]');
      if (media) {
        const image = media.querySelector('img');
        this.gallery = this.closest('slider-element');

        this.magnify(image);
        this.moveWithHover(image, event);
      }
    }
  }

  createOverlay(image) {
    const overlayImage = document.createElement('img');
    overlayImage.setAttribute('src', `${image.src}`);
    const overlay = document.createElement('media-hover-overlay');
    this.prepareOverlay(overlay, overlayImage);

    this.toggleLoadingSpinner(image);

    overlayImage.onload = () => {
      this.toggleLoadingSpinner(image);
      image.parentElement.insertBefore(overlay, image);
    };

    if (this.gallery) this.gallery.classList.add('magnify');

    return overlay;
  }

  prepareOverlay(container, image) {
    container.setAttribute('class', 'media z-10 absolute top-0 left-0 w-full h-full');
    container.setAttribute('aria-hidden', 'true');
    container.style.backgroundImage = `url('${image.src}')`;
    container.style.cursor = 'zoom-out';
  }

  toggleLoadingSpinner(image) {
    const loadingSpinner = image.parentElement;
    loadingSpinner.classList.toggle('loading');
    loadingSpinner.classList.toggle('pointer-events-none');
  }

  moveWithHover(image, event) {
    // calculate mouse position
    const ratio = image.height / image.width;
    const container = event.target.getBoundingClientRect();
    const xPosition = event.clientX - container.left;
    const yPosition = event.clientY - container.top;
    const xPercent = `${xPosition / (image.clientWidth / 100)}%`;
    const yPercent = `${yPosition / ((image.clientWidth * ratio) / 100)}%`;

    // determine what to show in the frame
    this.overlay.style.backgroundPosition = `${xPercent} ${yPercent}`;
    this.overlay.style.backgroundSize = `${image.width * this.zoomRatio}px`;
  }

  magnify(image) {
    this.overlay = this.createOverlay(image);
    this.overlay.onclick = () => this.reset();
    this.overlay.onmousemove = (event) => this.moveWithHover(image, event);
    this.overlay.onmouseleave = () => this.reset();
  }

  reset() {
    this.overlay.remove();

    if (this.gallery) this.gallery.classList.remove('magnify');
  }
}
customElements.define('media-hover-button', MediaHoverButton, { extends: 'button' });

class MediaDots extends SliderDots {
  connectedCallback() {
    super.connectedCallback();

    this.on(document, 'matchSmall', this.resetIndexes.bind(this));
    this.on(document, 'unmatchSmall', this.resetIndexes.bind(this));
  }

  init() {
    super.init();
    this.resetIndexes();
  }

  ensureIndexes() {
    if (!this.querySelector('[data-index]')) this.resetIndexes();
  }

  onChange(event) {
    this.ensureIndexes();
    super.onChange(event);
  }

  onButtonClick(event) {
    this.ensureIndexes();
    super.onButtonClick(event);
  }

  resetIndexes() {
    let newIndex = 1;
    this.itemsToShow.forEach((item, index) => {
      item.setAttribute('data-index', newIndex);
      item.setAttribute('aria-current', index === 0 ? 'true' : 'false');

      newIndex++;
    });
  }
}
customElements.define('media-dots', MediaDots);

class XModal extends ModalElement {

  get shouldLock() {
    return true;
  }

  get shouldAppendToBody() {
    return true;
  }
}
customElements.define('x-modal', XModal);

class LogoList extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
  }

  get childElement() {
    return this.firstElementChild;
  }

  get speed() {
    return this.hasAttribute('data-speed') ? parseInt(this.getAttribute('data-speed')) : 16;
  }

  get maximum() {
    return this.hasAttribute('data-maximum') ? parseInt(this.getAttribute('data-maximum')) : (this.childElementWidth > 0 ? Math.ceil(this.parentWidth / this.childElementWidth) + 2 : 0);
  }

  get direction() {
    return this.hasAttribute('data-direction') ? this.getAttribute('data-direction') : 'left';
  }

  get parentWidth() {
    return this.getWidth(this);
  }

  get childElementWidth() {
    return this.getWidth(this.childElement);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.marquee) {
      this.pause();
      this.marquee.destroy();
    }
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (this.childElementCount === 1) {
      this.cloned = true;
      this.childElement.classList.add('animated');

      const maximum = this.maximum;
      for (let index = 0; index < maximum; index++) {
        this.clone = this.childElement.cloneNode(true);
        this.clone.setAttribute('aria-hidden', true);
        this.appendChild(this.clone);
        this.clone.querySelectorAll('.media').forEach((media) => media.classList.remove('loading'));
      }
    }

    if (this.cloned) {
      if (theme.config.isTouch) {
        this.style.setProperty('--duration', `${33 - this.speed}s`);
      }
      else {
        this.marquee = new Flickity(this, {
          prevNextButtons: false,
          pageDots: false,
          wrapAround: true,
          freeScroll: true,
          rightToLeft: this.direction === 'right',
        });

        // Set initial position to be 0
        this.marquee.x = 0;

        // Start the marquee animation
        this.play();

        this.bindEvents();
      }
    }
  }

  bindEvents() {
    if (!this.marquee) return;

    this.on(this, 'mouseenter', this.pause);
    this.on(this, 'mouseleave', this.play);
  }

  play() {
    // Set the decrement of position x
    this.marquee.x -= this.speed * 0.1;

    // Settle position into the slider
    this.marquee.settle(this.marquee.x);

    // Set the requestId to the local variable
    this.requestId = requestAnimationFrame(this.play.bind(this));
  }

  pause() {
    if (this.requestId) {
      // Cancel the animation
      cancelAnimationFrame(this.requestId);

      // Reset the requestId for the next animation.
      this.requestId = undefined;
    }
  }

  getWidth(element) {
    const rect = element.getBoundingClientRect();
    return rect.right - rect.left;
  }
}
customElements.define('logo-list', LogoList);

class TextScrolling extends BaseElement {
  constructor() {
    super();

    this.items.forEach((item) => {
      const header = item.querySelector('.heading');

      const stopScroll = Motion.scroll(
        Motion.animate(header, { opacity: [0, 0, 1, 1, 1, 0, 0] }),
        { target: header, offsets: ['33vh', '66vh'] }
      );
      this.registerCleanup(stopScroll);
    });
  }

  get items() {
    return this._items = this._items || Array.from(this.children);
  }
}
customElements.define('text-scrolling', TextScrolling);

class TabsElement extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.selectedIndex = this.selectedIndex;
    this.buttons.forEach((button, index) => this.on(button, 'click', () => this.selectedIndex = index));

    if (Shopify.designMode) {
      this.on(this, 'shopify:block:select', (event) => this.selectedIndex = this.buttons.indexOf(event.target));
    }
  }

  static get observedAttributes() {
    return ['selected-index'];
  }

  get selectedIndex() {
    return parseInt(this.getAttribute('selected-index')) || 0;
  }

  set selectedIndex(index) {
    this.setAttribute('selected-index', Math.min(Math.max(index, 0), this.buttons.length - 1).toString());
  }

  get buttons() {
    return this._buttons = this._buttons || Array.from(this.querySelectorAll('button[role="tab"]'));
  }

  get indicators() {
    return this._indicators = this._indicators || Array.from(this.querySelectorAll('.indicators'));
  }

  load() {
    const toButton = this.buttons[parseInt(this.selectedIndex)];
    if (toButton === undefined) return;

    const toPanel = document.getElementById(toButton.getAttribute('aria-controls'));
    Motion.animate(toPanel, { transform: ['translateY(2rem)', 'translateY(0)'], opacity: [0, 1] }, { duration: theme.config.motionReduced ? 0 : 0.15 });

    const motionList = toPanel.querySelector('motion-list');
    if (motionList && motionList.initialized) {
      motionList.load();
    }
  }

  unload() {
    const fromButton = this.buttons[parseInt(this.selectedIndex)];
    if (fromButton === undefined) return;

    const fromPanel = document.getElementById(fromButton.getAttribute('aria-controls'));
    Motion.animate(fromPanel, { transform: ['translateY(0)', 'translateY(2rem)'], opacity: [1, 0] }, { duration: theme.config.motionReduced ? 0 : 0.15 });

    const motionList = fromPanel.querySelector('motion-list');
    if (motionList && motionList.initialized) {
      motionList.unload();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.buttons.forEach((button, index) => {
      button.classList.toggle('button--primary', index === parseInt(newValue));
      button.classList.toggle('button--secondary', index !== parseInt(newValue));
      button.disabled = index === parseInt(newValue);
    });

    this.indicators.forEach((indicators, index) => {
      indicators.hidden = index !== parseInt(newValue);
      if (index === parseInt(newValue)) {
        indicators.querySelectorAll('button').forEach((button) => {
          button?.unload();
          button?.load();
        });
      }
    });

    if (name === 'selected-index' && oldValue !== null && oldValue !== newValue) {
      const fromButton = this.buttons[parseInt(oldValue)];
      const toButton = this.buttons[parseInt(newValue)];
      this.transition(document.getElementById(fromButton.getAttribute('aria-controls')), document.getElementById(toButton.getAttribute('aria-controls')));
    }
  }

  async transition(fromPanel, toPanel) {
    if (fromPanel) {
      await Motion.animate(fromPanel, { transform: ['translateY(0)', 'translateY(2rem)'], opacity: [1, 0] }, { duration: theme.config.motionReduced ? 0 : 0.15 }).finished;
    }

    fromPanel.hidden = true;
    toPanel.hidden = false;
    Motion.animate(toPanel, { transform: ['translateY(2rem)', 'translateY(0)'], opacity: [0, 1] }, { duration: theme.config.motionReduced ? 0 : 0.15 });

    const motionList = toPanel.querySelector('motion-list');
    if (motionList && motionList.initialized) {
      motionList.load();
    }

    theme.a11y.trapFocus(this, toPanel.querySelector('slider-element') || toPanel.querySelector('a'));
  }
}
customElements.define('tabs-element', TabsElement);

class CountdownTimer extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
  }

  get date() {
    return this._date = this._date || new Date(this.getAttribute('data-expires'));
  }

  get isCompact() {
    return this.getAttribute('data-compact') === 'true' || (this.getAttribute('data-compact') === 'mobile' && theme.config.mqlSmall);
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.calculate();
    this.timerInterval = setInterval(this.calculate.bind(this), 1000);
    this.registerCleanup(() => clearInterval(this.timerInterval));
  }

  calculate() {
    const now = new Date(),
      countTo = new Date(this.date),
      timeDifference = (countTo - now);

    if (timeDifference < 0) {
      this.complete();
      return;
    }

    const secondsInADay = 60 * 60 * 1000 * 24,
      secondsInAHour = 60 * 60 * 1000;

    const days = Math.floor(timeDifference / (secondsInADay) * 1);
    const hours = Math.floor((timeDifference % (secondsInADay)) / (secondsInAHour) * 1);
    const mins = Math.floor(((timeDifference % (secondsInADay)) % (secondsInAHour)) / (60 * 1000) * 1);
    const secs = Math.floor((((timeDifference % (secondsInADay)) % (secondsInAHour)) % (60 * 1000)) / 1000 * 1);

    if (this.isCompact) {
      const dayHTML = days > 0 ? `<div class="countdown__item"><p>${days}${theme.dateStrings.d}</p></div>` : '';
      const hourHTML = `<div class="countdown__item"><p>${hours}${theme.dateStrings.h}</p></div>`;
      const minHTML = `<div class="countdown__item"><p>${mins}${theme.dateStrings.m}</p></div>`;
      const secHTML = `<div class="countdown__item"><p>${secs}${theme.dateStrings.s}</p></div>`;

      this.innerHTML = dayHTML + hourHTML + minHTML + secHTML;
    }
    else {
      const dayHTML = days > 0 ? `<div class="countdown__item"><p>${days}</p><span>${days === 1 ? theme.dateStrings.day : theme.dateStrings.days}</span></div>` : '';
      const hourHTML = `<div class="countdown__item"><p>${hours}</p><span>${hours === 1 ? theme.dateStrings.hour : theme.dateStrings.hours}</span></div>`;
      const minHTML = `<div class="countdown__item"><p>${mins}</p><span>${mins === 1 ? theme.dateStrings.minute : theme.dateStrings.minutes}</span></div>`;
      const secHTML = `<div class="countdown__item"><p>${secs}</p><span>${secs === 1 ? theme.dateStrings.second : theme.dateStrings.seconds}</span></div>`;

      this.innerHTML = dayHTML + hourHTML + minHTML + secHTML;
    }
  }

  complete() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.hidden = true;
  }
}
customElements.define('countdown-timer', CountdownTimer);

class ImageComparison extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, async () => {
      await theme.utils.imageLoaded(this.media);
      this.init();
    });
  }

  get button() {
    return this.querySelector('button');
  }

  get bounding() {
    return this.getBoundingClientRect();
  }

  get horizontal() {
    return this.getAttribute('data-layout') === 'horizontal';
  }

  get media() {
    return Array.from(this.querySelectorAll('img, svg'));
  }

  init() {
    this.active = false;

    this.on(this.button, 'touchstart', this.startHandler.bind(this), theme.supportsPassive ? { passive: false } : false);
    this.on(document.body, 'touchend', this.endHandler.bind(this), theme.supportsPassive ? { passive: true } : false);
    this.on(document.body, 'touchmove', this.onHandler.bind(this), theme.supportsPassive ? { passive: true } : false);

    this.on(this.button, 'mousedown', this.startHandler.bind(this));
    this.on(document.body, 'mouseup', this.endHandler.bind(this));
    this.on(document.body, 'mousemove', this.onHandler.bind(this));

    setTimeout(() => this.animate(), 1e3);
  }

  animate() {
    this.setAttribute('animate', '');

    this.classList.add('animated');
    setTimeout(() => {
      this.classList.remove('animated');
    }, 1e3);
  }

  startHandler(event) {
    event.preventDefault();
    this.active = true;
    this.classList.add('scrolling');
  }

  endHandler() {
    this.active = false;
    this.classList.remove('scrolling');
  }

  onHandler(e) {
    if (!this.active) return;

    const event = (e.touches && e.touches[0]) || e;
    let x = this.horizontal
      ? event.pageX - (this.bounding.left + window.scrollX)
      : event.pageY - (this.bounding.top + window.scrollY);

    this.scrollIt(x);
  }

  scrollIt(x) {
    const distance = this.horizontal ? this.clientWidth : this.clientHeight;

    const max = distance - 20;
    const min = 20;
    const mouseX = Math.max(min, (Math.min(x, max)));
    const mousePercent = (mouseX * 100) / distance;
    this.style.setProperty('--percent', mousePercent + '%');
  }
}
customElements.define('image-comparison', ImageComparison);

class LookbookElement extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, async () => {
      await theme.utils.imageLoaded(this.media);
      this.init();
    });
  }

  get media() {
    return Array.from(this.querySelectorAll('img, svg'));
  }

  get items() {
    return this._items = this._items || Array.from(this.querySelectorAll('.hotspot'));
  }

  init() {
    this.items.forEach((item) => {
      this.on(item, 'mouseenter', (event) => {
        this.select(this.items.indexOf(event.target));
      });
    });

    this.items.forEach((item) => {
      this.on(item, 'keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.select(this.items.indexOf(event.target));
        }
      });
    });

    if (Shopify.designMode) {
      const section = this.closest('.shopify-section');
      this.on(section, 'shopify:section:select', this.animate.bind(this));
      this.on(section, 'shopify:section:deselect', this.closeAll.bind(this));
      this.on(this, 'shopify:block:select', (event) => this.open(this.items.indexOf(event.target)));
    }

    setTimeout(() => this.animate(), 1e3);
  }

  animate() {
    this.openAll();

    this.timer = setTimeout(() => this.closeAll(), 3e3);
  }

  open(selectedIndex) {
    this.items.forEach((item, index) => item.classList.toggle('active', selectedIndex === index));
  }

  openAll() {
    this.items.forEach((item) => item.classList.add('active'));
  }

  closeAll() {
    this.items.forEach((item) => item.classList.remove('active'));
    clearTimeout(this.timer);
  }

  select(selectedIndex) {
    const selectedItem = this.items[selectedIndex];
    if (!selectedItem || selectedItem.getAttribute('aria-current') === 'true') {
      return;
    }

    this.items.forEach((item, index) => item.setAttribute('aria-current', selectedIndex === index ? 'true' : 'false'));
    this.dispatchEvent(new CustomEvent('lookbook:change', { bubbles: true, detail: { index: selectedIndex } }));
  }
}
customElements.define('lookbook-element', LookbookElement);

class ShopTheLook extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.on(this.lookbook, 'lookbook:change', (event) => this.carousel.select(event.detail.index));
    this.on(this.carousel, 'carousel:change', (event) => this.lookbook.select(event.detail.index));
  }

  get lookbook() {
    return this.querySelector('lookbook-element');
  }

  get carousel() {
    return this.querySelector('carousel-element');
  }
}
customElements.define('shop-the-look', ShopTheLook);

class SpinningText extends HTMLElement {
  constructor() {
    super();

    if (!theme.config.isTouch || Shopify.designMode) {
      Motion.inView(this, this.init.bind(this), { margin: '600px 0px 600px 0px' });
    }
    else {
      new theme.initWhenVisible(this.init.bind(this));
    }
  }

  get string() {
    let string = this.getAttribute('data-string');
    string = string.replace(/  +/g, ' ');
    return '•' + string.replace(/ +/g, '•')
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const canTrig = CSS.supports('(top: calc(sin(1) * 1px))');
    const OPTIONS = {
      TEXT: this.string,
      SIZE: 2,
      SPACING: 2,
    };

    const HEADING = document.createElement('div');
    const text = OPTIONS.TEXT;

    // Take the text and split it into spans...
    const chars = text.split('');
    this.style.setProperty('--char-count', chars.length);

    let charsHtml = '';
    for (let c = 0; c < chars.length; c++) {
      charsHtml += `<span aria-hidden="true" class="split-char" style="--char-index: ${c};">${chars[c]}</span>`;
    }
    charsHtml += `<span class="sr-only">${OPTIONS.TEXT}</span>`;
    HEADING.innerHTML = charsHtml;
    HEADING.classList = 'split-chars';

    // Set the styles
    this.style.setProperty('--font-size', OPTIONS.SIZE);
    this.style.setProperty('--character-width', OPTIONS.SPACING);
    this.style.setProperty(
      '--radius',
      canTrig
        ? 'calc((var(--character-width) / sin(var(--inner-angle))) * -1ch)'
        : `calc(
        (${OPTIONS.SPACING} / ${Math.sin(
          360 / this.children.length / (180 / Math.PI)
        )})
        * -1ch
      )`
    );

    // Append
    this.appendChild(HEADING);
  }
}
customElements.define('spinning-text', SpinningText);

class SlideshowElement extends BaseElement {
  constructor() {
    super();

    this.selectedIndex = this.selectedIndex;

    Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
  }

  static get observedAttributes() {
    return ['selected-index'];
  }

  get selectedIndex() {
    return parseInt(this.getAttribute('selected-index')) || 0;
  }

  set selectedIndex(index) {
    this.setAttribute('selected-index', Math.min(Math.max(index, 0), this.items.length - 1).toString());
  }

  get items() {
    return this._items = this._items || Array.from(this.children);
  }

  get autoplay() {
    return this.hasAttribute('autoplay');
  }

  get speed() {
    return this.hasAttribute('autoplay') ? parseInt(this.getAttribute('autoplay-speed')) * 1000 : 5000;
  }

  get adaptiveHeightProperty() {
    return false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const that = this;
    if (this.items.length > 1) {
      this.slider = new Flickity(this, {
        accessibility: false,
        pageDots: false,
        prevNextButtons: false,
        wrapAround: true,
        rightToLeft: theme.config.rtl,
        autoPlay: this.autoplay ? this.speed : false,
        adaptiveHeightProperty: this.adaptiveHeightProperty,
        on: {
          ready: function () {
            const { selectedElement } = this;
            that.onReady(selectedElement);
          }
        }
      });

      this.slider.on('change', this.onChange.bind(this));
      this.bindEvents();
    }
    else if (this.items.length === 1) {
      const selectedElement = this.firstChild;
      that.onReady(selectedElement);
    }
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  bindEvents() {
    if (!this.slider) return;

    this.on(this, 'slider:previous', () => this.slider.previous());
    this.on(this, 'slider:next', () => this.slider.next());
    this.on(this, 'slider:play', () => this.slider.playPlayer());
    this.on(this, 'slider:pause', () => this.slider.pausePlayer());

    if (Shopify.designMode) {
      this.on(this, 'shopify:block:select', (event) => this.slider.select(this.items.indexOf(event.target)));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.slider) this.slider.destroy();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'selected-index' && oldValue !== null && oldValue !== newValue) {
      const fromElement = this.items[parseInt(oldValue)];
      const toElement = this.items[parseInt(newValue)];

      const animateElement = toElement.querySelector('animate-element');
      animateElement?.refresh();

      if (fromElement.getAttribute('data-type') === 'video') {
        const fromVideoElement = theme.utils.visibleMedia(fromElement.querySelectorAll('video-media'));
        fromVideoElement?.pause();
      }

      if (toElement.getAttribute('data-type') === 'video') {
        const toVideoElement = theme.utils.visibleMedia(toElement.querySelectorAll('video-media'));
        toVideoElement?.play();
      }
    }
  }

  onChange() {
    this.selectedIndex = this.slider.selectedIndex;
    this.dispatchEvent(new CustomEvent('slider:change', { bubbles: true, detail: { currentPage: this.slider.selectedIndex } }));
  }

  select(selectedIndex) {
    this.slider.select(selectedIndex);
  }

  onReady(selectedElement) {
    if (selectedElement.getAttribute('data-type') === 'video') {
      const videoElement = theme.utils.visibleMedia(selectedElement.querySelectorAll('video-media'));
      videoElement?.play();
    }

    if (!theme.config.isTouch && document.body.hasAttribute('data-page-transition')) {
      const animateElement = selectedElement.querySelector('animate-element');
      animateElement?.refresh();
    }
  }
}
customElements.define('slideshow-element', SlideshowElement);

class SlideshowHero extends SlideshowElement {
  constructor() {
    super();

    this.onScrollListener = theme.utils.throttle(this.onScrollHandler.bind(this));
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(window, 'scroll', this.onScrollListener, { passive: true });
    this.registerCleanup(() => this.onScrollListener.cancel());
  }

  get adaptiveHeightProperty() {
    return true;
  }

  get heroSection() {
    return this.closest('.hero-section');
  }

  get nextSection() {
    let nextSibling = this.heroSection.nextElementSibling;
    for (let i = 0; i < 20; i++) {
      if (nextSibling.classList.contains('shopify-section') && !nextSibling.classList.contains('header-section')) break;
      nextSibling = nextSibling.nextElementSibling;
    }

    if (nextSibling && nextSibling.nodeType != 1) {
      nextSibling = document.getElementById('PageContainer');
    }

    return nextSibling;
  }

  onScrollHandler() {
    const bounding = this.nextSection.getBoundingClientRect();
    this.heroSection.classList.toggle('hero-scrolled', bounding.y < -30);
  }
}
customElements.define('slideshow-hero', SlideshowHero);

class SlideshowWords extends BaseElement {
  constructor() {
    super();

    this.selectedIndex = this.selectedIndex;

    if (this.controlledElement) {
      this.on(this.controlledElement, 'slider:change', (event) => this.selectedIndex = event.detail.currentPage);
    }
  }

  static get observedAttributes() {
    return ['selected-index'];
  }

  get selectedIndex() {
    return parseInt(this.getAttribute('selected-index')) || 0;
  }

  set selectedIndex(index) {
    this.setAttribute('selected-index', Math.min(Math.max(index, 0), this.items.length - 1).toString());
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get items() {
    return this._items = this._items || Array.from(this.children);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'selected-index' && oldValue !== null && oldValue !== newValue) {
      this.transition(this.items[parseInt(oldValue)], this.items[parseInt(newValue)]);
    }
  }

  transition(fromElement, toElement) {
    const fromWords = Array.from(fromElement.querySelectorAll('animate-element'));
    const toWords = Array.from(toElement.querySelectorAll('animate-element'));

    fromWords.forEach((element) => element.reset());

    setTimeout(() => {
      this.items.forEach((item) => {
        item.setAttribute('aria-current', parseInt(item.getAttribute('data-index')) === parseInt(this.selectedIndex) ? 'true' : 'false');
      });

      toWords.forEach((element) => element.refresh());
    }, 500 + (30 * fromWords.length));
  }
}
customElements.define('slideshow-words', SlideshowWords, { extends: 'nav' });

class SlideshowParallax extends BaseElementMixin(HTMLDivElement) {
  constructor() {
    super();

    this.load();
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get mobileDisabled() {
    return false;
  }

  load() {
    if (theme.config.motionReduced) return;
    if (this.mobileDisabled && (theme.config.isTouch || theme.config.mqlSmall)) return;

    this.motion();
  }

  motion() {
    const cancelParallax = Motion.scroll(
      Motion.animate(this, { transform: [`translateY(${this.getAttribute('data-start')})`, `translateY(${this.getAttribute('data-stop')})`] }),
      { target: this.controlledElement ?? document.body, offset: Motion.ScrollOffset.Exit }
    );
    this.registerCleanup(cancelParallax);
  }
}
customElements.define('slideshow-parallax', SlideshowParallax, { extends: 'div' });

class ControlButton extends BaseElementMixin(HTMLButtonElement) {
  constructor() {
    super();

    this.pauseLabel = this.getAttribute('data-pause-label');
    this.playLabel = this.getAttribute('data-play-label');
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'click', this.onClick);
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get paused() {
    return this.hasAttribute('paused');
  }

  static get observedAttributes() {
    return ['paused'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'paused') {
      this.updateAriaLabel();

      if (oldValue === null && newValue === '') {
        return (this.controlledElement ?? this).dispatchEvent(new CustomEvent('slider:pause', { bubbles: true }));
      }

      if (newValue === null) {
        return (this.controlledElement ?? this).dispatchEvent(new CustomEvent('slider:play', { bubbles: true }));
      }
    }
  }

  onClick() {
    this.paused ? this.removeAttribute('paused') : this.setAttribute('paused', '');
  }

  updateAriaLabel() {
    this.setAttribute('aria-label', this.paused ? this.playLabel : this.pauseLabel);
  }
}
customElements.define('control-button', ControlButton, { extends: 'button' });

class QuickView extends XModal {

  get selector() {
    return '.quick-view__content';
  }

  connectedCallback() {
    super.connectedCallback();

    const cartUpdateUnsubscriber = theme.pubsub.subscribe(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, this.hide.bind(this));
    this.registerCleanup(cartUpdateUnsubscriber);
  }

  beforeShow() {
    super.beforeShow();
    this.quickview();
  }

  afterShow() {
    super.afterShow();

    document.dispatchEvent(new CustomEvent('quickview:open', {
      detail: {
        productUrl: this.getAttribute('data-product-url')
      }
    }));
  }

  afterHide() {
    super.afterHide();

    this.quickviewAbortController?.abort();

    const drawerContent = this.querySelector(this.selector);
    drawerContent.innerHTML = '';
  }

  quickview() {
    const drawerContent = this.querySelector(this.selector);
    const productUrl = this.getAttribute('data-product-url').split('?')[0];
    const sectionUrl = `${productUrl}?view=modal`;

    this.quickviewAbortController?.abort();
    this.quickviewAbortController = new AbortController();
    const { signal } = this.quickviewAbortController;

    fetch(sectionUrl, { signal })
      .then(response => response.text())
      .then(responseText => {
        setTimeout(() => {
          if (signal.aborted) return;

          const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
          const scope = parsedHTML.getElementById('MainContent') || parsedHTML;
          const productElement = scope.querySelector(this.selector);

          if (!productElement) {
            console.error('[QuickView] Missing content in response:', sectionUrl);
            this.hide();
            return;
          }

          this.setInnerHTML(drawerContent, productElement.innerHTML);
          theme.a11y.trapFocus(this, this.focusElement);

          if (window.Shopify && Shopify.PaymentButton) {
            Shopify.PaymentButton.init();
          }

          document.dispatchEvent(new CustomEvent('quickview:loaded', {
            detail: {
              productUrl: this.getAttribute('data-product-url')
            }
          }));
        }, 200);
      })
      .catch(e => {
        if (e.name !== 'AbortError') console.error(e);
      });
  }

  setInnerHTML(element, innerHTML) {
    element.innerHTML = innerHTML;

    // Reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
    element.querySelectorAll('script').forEach(oldScriptTag => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach(attribute => {
        newScriptTag.setAttribute(attribute.name, attribute.value)
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}
customElements.define('quick-view', QuickView);

class FiltersToggle extends HoverButton {
  constructor() {
    super();

    if (theme.config.hasLocalStorage) {
      const expanded = window.localStorage.getItem(`${theme.settings.themeName}:filters-toggle`) || 'false';
      this.onToggle(expanded === 'true');
    }
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'click', this.onClick);
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get expanded() {
    return this.getAttribute('aria-expanded') === 'true';
  }

  onClick() {
    this.onToggle(this.expanded);
  }

  onToggle(expanded) {
    this.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    if (this.controlledElement) this.controlledElement.classList.toggle('xl:block', !expanded);

    if (theme.config.hasLocalStorage) {
      window.localStorage.setItem(`${theme.settings.themeName}:filters-toggle`, expanded);
    }
  }
}
customElements.define('filters-toggle', FiltersToggle, { extends: 'button' });

class RevealBanner extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this), { margin: '600px 0px 600px 0px' });
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const tracker = this.querySelector('.reveal-banner__tracker');
    const stopMediaReveal = Motion.scroll(
      Motion.animate(this.querySelectorAll('.banner__media'), { clipPath: ['inset(20% 35% 0% 35% round var(--rounded-block))', 'inset(0% 0%)'] }, { easing: 'linear' }),
      { target: tracker, offset: Motion.ScrollOffset.Enter }
    );
    this.registerCleanup(stopMediaReveal);

    const tracker2nd = this.querySelector('.reveal-banner__tracker2nd');
    if (tracker2nd) {
      const stopContentReveal = Motion.scroll(Motion.timeline([
        [this.querySelector('.banner__overlay'), { opacity: [0, 1] }, { easing: 'linear' }],
        [this.querySelector('.banner__content'), { opacity: [0, 1], visibility: ['hidden', 'visible'], transform: ['translateY(10%)', 'translateY(0)'] }, { easing: 'linear', at: '<' }],
      ]), { target: tracker2nd, offset: Motion.ScrollOffset.Enter });
      this.registerCleanup(stopContentReveal);
    }
  }
}
customElements.define('reveal-banner', RevealBanner);

class TestimonialParallax extends ParallaxElement {

  get mobileDisabled() {
    return true;
  }
}
customElements.define('testimonial-parallax', TestimonialParallax, { extends: 'div' });

class SplittingBanner extends BaseElement {
  constructor() {
    super();

    Motion.inView(this, this.init.bind(this), { margin: '600px 0px 600px 0px' });
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Memoized: re-splitting already-split text would nest the char spans.
    const splitting = this.splitResult = this.splitResult || Splitting({ target: this.querySelector('.splitting'), by: 'chars', whitespace: true });

    const wrapper = this.querySelector('.splitting-wrapper');
    const tracker = this.querySelector('.reveal-banner__tracker');
    const stopCharsReveal = Motion.scroll(Motion.timeline([
      [splitting[0].chars, { opacity: [0.3, 1] }, { delay: theme.config.motionReduced ? 0 : Motion.stagger(0.1) }],
      //[wrapper, { transform: ['translateY(-20vh)', 'translateY(0)'] }, { easing: 'linear', at: '<' }]
    ]), { target: tracker, offset: Motion.ScrollOffset.Enter });
    this.registerCleanup(stopCharsReveal);

    const stopWrapperFade = Motion.scroll(
      Motion.animate(wrapper, { opacity: theme.config.mqlSmall ? [1, 0, 0] : [1, 1, 0] }, { easing: 'linear' }),
      { target: tracker, offset: Motion.ScrollOffset.Exit }
    );
    this.registerCleanup(stopWrapperFade);

    const tracker2nd = this.querySelector('.reveal-banner__tracker2nd');
    if (tracker2nd) {
      const stopButtonReveal = Motion.scroll(
        Motion.animate(this.querySelector('.button-wrapper'), { opacity: [0, 1, 1], transform: ['translateY(100%)', 'translateY(0)'] }, { easing: 'linear' }),
        { target: tracker2nd, offset: Motion.ScrollOffset.Enter }
      );
      this.registerCleanup(stopButtonReveal);
    }
  }
}
customElements.define('splitting-banner', SplittingBanner);

class ProductCardInfo extends ProductInfo {
  constructor() {
    super();

    this._sectionId = 'ProductCard-template';
  }

  get pickerType() {
    return this.getAttribute('data-picker-type');
  }

  buildRequestUrlWithParams(url, optionValues) {
    const params = [];
    params.push('view=bundle-card');

    if (optionValues.length) {
      params.push(`option_values=${optionValues.join(',')}`);
    }

    return `${url}?${params.join('&')}`;
  }

  updateSourceFromDestination(parsedHTML, id) {
    const source = parsedHTML.getElementById(`${id}-${this._sectionId}-${this.productId}`);
    const destination = document.querySelector(`#${id}-${this.sectionId}-${this.productId}`);
    if (source && destination) {
      destination.innerHTML = source.innerHTML;
      destination.removeAttribute('hidden');
    }
  }

  get gallerySourceSectionId() {
    return this._sectionId;
  }

  updateOptionValues(parsedHTML) {
    const variantPicker = parsedHTML.getElementById(`VariantPicker-${this._sectionId}-${this.productId}-${this.pickerType}`);
    if (variantPicker) {
      theme.HTMLUpdateUtility.viewTransition(this.variantSelectors, variantPicker, this.preProcessHtmlCallbacks);
    }
  }

  getSelectedVariant(productInfoNode) {
    const selectedVariant = productInfoNode.querySelector(`product-card-info[data-product-id="${this.productId}"] [data-selected-variant]`)?.textContent;
    return !!selectedVariant ? JSON.parse(selectedVariant) : null;
  }
}
customElements.define('product-card-info', ProductCardInfo);

class ProductBundleForm extends BaseElementMixin(HTMLFormElement) {
  connectedCallback() {
    super.connectedCallback();

    this.querySelector('[name="id"]').disabled = false;
    this.on(this, 'submit', this.onSubmitHandler);
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get submitButton() {
    return this._submitButton = this._submitButton || this.querySelector('[type="submit"]');
  }

  getSelectedVariant() {
    const selectedVariant = this.querySelector('[data-selected-variant]')?.textContent;
    return !!selectedVariant ? JSON.parse(selectedVariant) : null;
  }

  onSubmitHandler(event) {
    event.preventDefault();
    if (this.submitButton.hasAttribute('aria-disabled')) return;

    const product = this.closest('.product-card');
    const variant = this.getSelectedVariant();
    variant.default_featured_media = this.hasAttribute('data-product-image') ? this.getAttribute('data-product-image') : '';

    this.submitButton.removeAttribute('aria-busy');
    (this.controlledElement ?? this).dispatchEvent(new CustomEvent('bundle:added', { bubbles: true, detail: { product: product, variant: variant } }));
  }

  handleErrorMessage() {
    // todo
  }

  toggleSubmitButton(disable = true, text) {
    if (!this.submitButton) return;

    const submitButtonText = this.submitButton.querySelector('.btn-text');
    const submitButtonTextChild = this.submitButton.querySelector('.btn-text>span');

    if (disable) {
      this.submitButton.setAttribute('disabled', '');
      if (text) {
        (submitButtonTextChild || submitButtonText).textContent = text;
      }
    }
    else {
      this.submitButton.removeAttribute('disabled');
      (submitButtonTextChild || submitButtonText).textContent = theme.variantStrings.addToBundle;
    }
  }
}
customElements.define('product-bundle-form', ProductBundleForm, { extends: 'form' });

class ProductBundleRemoveButton extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'click', (event) => {
      const variant = event.target.closest('[data-product-bundle-variant]');
      (this.controlledElement ?? this).dispatchEvent(new CustomEvent('bundle:removed', { bubbles: true, detail: { variant: variant } }));
    });
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }
}
customElements.define('product-bundle-remove-button', ProductBundleRemoveButton);

class ProductBundleToggleButton extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'click', () => {
      this.controlledElement.classList.toggle('active');
    });
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }
}
customElements.define('product-bundle-toggle-button', ProductBundleToggleButton);

class ProductBundle extends BaseElement {
  constructor() {
    super();

    this.template;
    this.bundleCount = 0;
  }

  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'bundle:added', this.onAddHandler.bind(this));
    this.on(this, 'bundle:removed', this.onRemoveHandler.bind(this));
    this.on(this, 'change', theme.utils.debounce(this.onChangeHandler.bind(this), 300));
    this.on(this.submitButton, 'click', this.onSubmitHandler.bind(this));
  }

  get bundleMin() {
    return this.hasAttribute('data-minimum') ? parseInt(this.getAttribute('data-minimum')) : 3;
  }

  get bundleMax() {
    const minimum = this.bundleMin;
    const maximum = this.hasAttribute('data-maximum') ? parseInt(this.getAttribute('data-maximum')) : 3;
    return maximum > minimum ? maximum : minimum;
  }

  get variants() {
    return Array.from(this.querySelectorAll('[data-product-bundle-variant]'));
  }

  get submitButton() {
    return this.querySelector('[data-product-bundle-submit]');
  }

  get cartDrawer() {
    return document.querySelector('cart-drawer');
  }

  get preventDuplicate() {
    return this.hasAttribute('data-prevent-duplicate');
  }

  get template() {
    return this._template = this._template || this.querySelector('[data-product-bundle-variant][available]').cloneNode(true);
  }

  onChangeHandler() {
    this.updateTotal();
    this.updateTotalWithCurrency();
    this.updateProgressBar();
  }

  onSubmitHandler(event) {
    const validateQuantity = this.variants.every((variant) => {
      const target = variant.querySelector('quantity-input').input;
      const inputValue = parseInt(target.value);
      let message = '';

      if (inputValue < parseInt(target.getAttribute('data-min'))) {
        message = theme.quickOrderListStrings.minError.replace('[min]', target.getAttribute('data-min'));
      }
      else if (inputValue > parseInt(target.max)) {
        message = theme.quickOrderListStrings.maxError.replace('[max]', target.max);
      }
      else if (inputValue % parseInt(target.step) !== 0) {
        message = theme.quickOrderListStrings.stepError.replace('[step]', target.step);
      }

      if (message) {
        target.setCustomValidity(message);
        target.reportValidity();
        target.value = target.defaultValue;
        target.select();

        return false;
      }

      return true;
    });
    if (!validateQuantity) return;

    const data = {
      items: this.variants.map(variant => ({
        id: variant.getAttribute('data-variant-id'),
        quantity: variant.querySelector('quantity-input').value || 1
      }))
    };

    if (document.body.classList.contains('template-cart') || theme.settings.cartType === 'page') {
      theme.utils.postLink2(theme.routes.cart_add_url, {
        parameters: {
          ...data
        }
      });
      return;
    }

    event.preventDefault();
    if (this.submitButton.hasAttribute('aria-disabled')) return;
    this.activeElement = event.submitter || event.currentTarget;

    this.handleErrorMessage();

    let sectionsToBundle = [];
    document.documentElement.dispatchEvent(new CustomEvent('cart:bundled-sections', { bubbles: true, detail: { sections: sectionsToBundle } }));

    const body = JSON.stringify({
      ...data,
      sections: sectionsToBundle,
      sections_url: window.location.pathname
    });

    this.error = false;
    this.submitButton.setAttribute('aria-disabled', 'true');
    this.submitButton.setAttribute('aria-busy', 'true');

    fetch(theme.routes.cart_add_url, { ...theme.utils.fetchConfig('javascript'), body })
      .then((response) => response.json())
      .then(async (parsedState) => {
        if (parsedState.status) {
          this.handleErrorMessage(parsedState.description);
          document.dispatchEvent(new CustomEvent('ajaxProduct:error', {
            detail: {
              errorMessage: parsedState.description
            }
          }));

          const submitButtonText = this.submitButton.querySelector('.btn-text>span');
          if (submitButtonText && submitButtonText.hasAttribute('data-sold-out')) {
            submitButtonText.innerText = submitButtonText.getAttribute('data-sold-out');
            this.submitButton.setAttribute('aria-disabled', 'true');
            this.error = true;
          }

          const cartJson = await (await fetch(theme.routes.cart_url, { ...theme.utils.fetchConfig('json', 'GET') })).json();
          theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, { source: 'product-bundle', cart: cartJson });

          document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { open: false } }));
          this.resetVariants();
          return;
        }

        const cartJson = await (await fetch(theme.routes.cart_url, { ...theme.utils.fetchConfig('json', 'GET') })).json();
        cartJson['sections'] = parsedState['sections'];

        theme.pubsub.publish(theme.pubsub.PUB_SUB_EVENTS.cartUpdate, { source: 'product-bundle', cart: cartJson });
        document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
          detail: {
            product: parsedState
          }
        }));

        this.cartDrawer?.show(this.activeElement);
        this.resetVariants();
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        this.submitButton.removeAttribute('aria-busy');

        if (!this.error) {
          this.submitButton.removeAttribute('aria-disabled');
        }
      });
  }

  handleErrorMessage(errorMessage = false) {
    if (this.hideErrors) return;

    this.errorMessage = this.errorMessage || this.querySelector('.product-form__error-message');
    if (!this.errorMessage) return;

    this.errorMessage.toggleAttribute('hidden', !errorMessage);
    this.errorMessage.innerText = errorMessage;
  }

  onAddHandler(event) {
    this.addVariant(event.detail.product, event.detail.variant);
    this.updateTotal();
    this.updateTotalWithCurrency();
    this.updateProgressBar();
  }

  onRemoveHandler(event) {
    this.clearVariant(event.detail.variant);
    this.reorderVariants();
    this.updateTotal();
    this.updateTotalWithCurrency();
    this.updateProgressBar();
  }

  updateTotal() {
    let subtotal = 0;
    this.variants.forEach((variant) => {
      if (!variant.hasAttribute('available')) {
        const price = variant.querySelector('[data-product-bundle-variant-price]');
        const quantityInput = variant.querySelector('quantity-input');
        subtotal += parseInt(price.getAttribute('data-price')) * parseInt(quantityInput.value);
      }
    });

    const element = this.querySelector('[data-product-bundle-total]');
    element.innerHTML = theme.Currency.formatMoney(subtotal, theme.settings.moneyFormat);
  }

  updateTotalWithCurrency() {
    let subtotal = 0;
    this.variants.forEach((variant) => {
      if (!variant.hasAttribute('available')) {
        const price = variant.querySelector('[data-product-bundle-variant-price]');
        const quantityInput = variant.querySelector('quantity-input');
        subtotal += parseInt(price.getAttribute('data-price')) * parseInt(quantityInput.value);
      }
    });

    const element = this.querySelector('[data-product-bundle-total-with-currency]');
    element.innerHTML = theme.Currency.formatMoney(subtotal, theme.settings.moneyWithCurrencyFormat);
  }

  updateProgressBar() {
    const percent = 100 * this.bundleCount / this.bundleMin;
    const element = this.querySelector('[data-product-bundle-progress-bar]');
    element.style.setProperty('--progress', `${percent}%`);
  }

  addVariant(product, variant) {
    this.bundleCount++;

    if (this.bundleCount >= this.bundleMin) {
      this.submitButton.disabled = false;
    }
    if (this.bundleCount >= this.bundleMax) {
      this.closest('.product-bundle-wrapper').setAttribute('locked', '');
    }

    let variantElement = this.getAvailableAvriant();
    if (variantElement === null) {
      variantElement = this.template.cloneNode(true);
      variantElement.style.order = this.bundleCount;
      this.querySelector('.product-bundle__body').appendChild(variantElement);
    }

    if (variantElement) {
      const preview_image = variant.featured_media ? variant.featured_media.preview_image.src : variant.default_featured_media;
      const media = variantElement.querySelector('[data-product-bundle-variant-media]');
      if (preview_image.length > 0) {
        media.removeAttribute('aria-hidden');
        media.innerHTML = `<img src="${this.getResizedImageSrc(preview_image, 180)}" srcset="${this.getResizedImageSrc(preview_image, 180)} 180w, ${this.getResizedImageSrc(preview_image, 360)} 360w, ${this.getResizedImageSrc(preview_image, 540)} 540w" loading="lazy" is="lazy-image" />`;
      }

      const content = variantElement.querySelector('[data-product-bundle-variant-content]');
      content.innerHTML = `
        <div class="flex flex-col gap-1">
          <p class="horizontal-product__title font-medium text-base leading-tight">${product.querySelector('[data-product-bundle-title]').textContent}</p>
          ${variant.options.length > 0 ? `
            <ul class="grid gap-1d5">
              ${variant.options.map(option => {
        if (option !== 'Default Title') {
          return `<li class="text-xs text-opacity leading-tight">${option}</li>`;
        }
      }).join('')}
            </ul>
          ` : ''}
        </div>
        <div class="price text-sm flex flex-wrap gap-1d5" data-price="${variant.price}" data-product-bundle-variant-price>
          ${theme.Currency.formatMoney(variant.price, theme.settings.moneyFormat)}
        </div>`;

      variantElement.product = product;
      variantElement.setAttribute('data-variant-id', variant.id);
      variantElement.removeAttribute('available');
      if (this.preventDuplicate) {
        product.setAttribute('locked', '');
      }
    }
  }

  clearVariant(variant) {
    if (this.preventDuplicate) {
      variant.product.removeAttribute('locked');
    }
    variant.setAttribute('available', '');
    variant.removeAttribute('data-variant-id');
    variant.querySelector('[data-product-bundle-variant-media]').innerHTML = '';
    variant.querySelector('[data-product-bundle-variant-media]').classList.remove('loading');
    variant.querySelector('[data-product-bundle-variant-media]').setAttribute('aria-hidden', 'true');
    variant.querySelector('[data-product-bundle-variant-content]').innerHTML = '<span class="horizontal-product__skeleton"></span><span class="horizontal-product__skeleton"></span>';
    variant.querySelector('quantity-input').reset();

    this.bundleCount--;

    if (this.bundleCount < this.bundleMin) {
      this.submitButton.disabled = true;
    }
    else {
      variant.remove();
    }
    if (this.bundleCount < this.bundleMax) {
      this.closest('.product-bundle-wrapper').removeAttribute('locked');
    }
  }

  reorderVariants() {
    let order = 0;
    let minimum = Math.max(this.bundleMin, this.bundleCount) * -1;
    this.variants.forEach((variant) => {
      variant.style.order = variant.hasAttribute('available') ? order++ : minimum++;
    });
  }

  resetVariants() {
    this.variants.forEach((variant) => {
      this.clearVariant(variant);
    });

    this.reorderVariants();
    this.updateTotal();
    this.updateTotalWithCurrency();
    this.updateProgressBar();
  }

  getAvailableAvriant() {
    return this.querySelector('[data-product-bundle-variant][available]');
  }

  getResizedImageSrc(src, size) {
    return `${src}${src.includes("?") ? "&" : "?"}width=${size}&height=${size}`.replace(/\n|\r|\s/g, "");
  }
}
customElements.define('product-bundle', ProductBundle);

class NumberCounter extends HTMLElement {
  constructor() {
    super();

    if (theme.config.motionReduced) return;

    if (!theme.config.isTouch || Shopify.designMode) {
      Motion.inView(this, this.init.bind(this), { margin: '200px 0px 200px 0px' });
    }
    else {
      new theme.initWhenVisible(this.init.bind(this));
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const matches = this.textContent.trim().match(/\d+(?:[,. ]\d+)*/);
    const toReplace = matches[0].replace(/[,\. ]+/, "");

    Motion.animate((progress) => {
      const formattedString = Math.round(progress * parseInt(toReplace)).toString();
      this.textContent = progress === 1 ? matches[0] : formattedString;
    }, { duration: parseFloat(this.getAttribute('data-duration')), easing: [0.16, 1, 0.3, 1] });
  }
}
customElements.define('number-counter', NumberCounter);

class ScrollingBanner extends BaseElement {
  constructor() {
    super();

    if (!theme.config.isTouch || Shopify.designMode) {
      Motion.inView(this, this.init.bind(this), { margin: '600px 0px 600px 0px' });
    }
    else {
      new theme.initWhenVisible(this.init.bind(this));
    }
  }

  get media() {
    return this._media = this._media || Array.from(this.querySelectorAll('.image-with-text__image>.media'));
  }

  get stickyElement() {
    return this.querySelector('sticky-element');
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.detectScrollListener = theme.utils.throttle(this.onScrollHandler.bind(this));

    this.mql = window.matchMedia('screen and (min-width: 1024px)');
    if (this.mql.matches) this.load();
    this.mql.onchange = (mql) => {
      mql.matches ? this.load() : this.unload();
    }
  }

  setMediaHeight() {
    let height = 0;
    this.media.forEach((media) => {
      height += media.getBoundingClientRect().height;
    });
    this.style.setProperty('--scrolling-height', `${height.toFixed(1)}px`);
  }

  onScrollHandler() {
    const scrollTop = window.scrollY;

    if (this.currentScrollTop === scrollTop) return;
    this.currentScrollTop = scrollTop;
    const offsetTop = this.getBoundingClientRect().top - parseFloat(this.stickyElement.inset);

    const mediaElements = this.media;
    const mediaCount = mediaElements.length;

    if (offsetTop < 0) {
      let activeIndex = 1;

      // Start from second element
      for (let i = 1; i < mediaCount; i++) {
        const media = mediaElements[i];
        const mediaHeight = media.getBoundingClientRect().height;
        const mediaScrollTop = mediaHeight * (i - 1);

        if (Math.abs(offsetTop) > mediaScrollTop) {
          activeIndex = i;
          let progress = 100 - Math.floor((Math.abs(offsetTop) - mediaScrollTop) / mediaHeight * 100);
          if (progress > 95) progress = 100;
          if (progress < 5) progress = 0;

          media.style.clipPath = `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`;
          this.updateControlledElement(media, progress);
        }
        else {
          media.style.clipPath = '';
        }
      }

      // Update remaining elements
      for (let i = activeIndex + 1; i < mediaCount; i++) {
        const media = mediaElements[i];
        this.updateControlledElement(media, 100);
      }
    }
    else {
      // Reset all elements when scrolled to top
      for (let i = 1; i < mediaCount; i++) {
        const media = mediaElements[i];
        media.style.clipPath = '';
        this.updateControlledElement(media, 100);
      }
    }
  }

  updateControlledElement(media, progress) {
    const controlledElement = media.hasAttribute('aria-controls') ? document.getElementById(media.getAttribute('aria-controls')) : null;
    if (controlledElement) {
      if (progress === 100) controlledElement.classList.add('opacity-0', 'pointer-events-none');
      if (progress === 0) controlledElement.classList.remove('opacity-0', 'pointer-events-none');
    }
  }

  load() {
    this.setMediaHeight();
    window.addEventListener('scroll', this.detectScrollListener, { passive: true });
  }

  unload() {
    window.removeEventListener('scroll', this.detectScrollListener);
    this.style.removeProperty('--scrolling-height');
    this.media.forEach((media) => {
      media.style.clipPath = '';
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener('scroll', this.detectScrollListener);
    this.detectScrollListener?.cancel?.();
    if (this.mql) this.mql.onchange = null;
  }
}
customElements.define('scrolling-banner', ScrollingBanner);

class SecondaryVideo extends BaseElementMixin(HTMLDivElement) {
  connectedCallback() {
    super.connectedCallback();

    if (theme.config.motionReduced || theme.config.isTouch) return;

    if (this.videoMedia) {
      this.on(this, 'mouseenter', this.onEnterHandler);
      this.on(this, 'mouseleave', this.onLeaveHandler);
    }
  }

  get videoMedia() {
    return this.querySelector('video-media');
  }

  onEnterHandler() {
    const media = this.videoMedia;
    if (media && media.hasAttribute('autoplay')) {
      media.play();
    }
  }

  onLeaveHandler() {
    const media = this.videoMedia;
    if (media) {
      media.pause();
    }
  }
}
customElements.define('secondary-video', SecondaryVideo, { extends: 'div' });

class SocialFeed extends XModal {
  constructor() {
    super();

    this.onKeyup = this.onKeyup.bind(this);
  }

  get shouldCloseAll() {
    return true;
  }

  get lookbook() {
    return this.querySelector('lookbook-element');
  }

  get previousButton() {
    return this.querySelector('button[data-button="previous"]');
  }

  get nextButton() {
    return this.querySelector('button[data-button="next"]');
  }

  connectedCallback() {
    super.connectedCallback();
    this.on(this, 'keyup', this.onKeyup);
  }

  beforeShow() {
    super.beforeShow();
    this.lookbook.closeAll();
  }

  async afterShow() {
    super.afterShow();
    Motion.inView(this.lookbook, async () => {
      await theme.utils.imageLoaded(this.lookbook.media);
      this.lookbook.animate();
    });
  }

  onKeyup(event) {
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      const button = event.code === 'ArrowLeft' ? this.previousButton : this.nextButton;
      if (button && !button.disabled) {
        event.preventDefault();
        button.dispatchEvent(new Event('click'));
      }
    }
  }
}
customElements.define('social-feed', SocialFeed);

class SocialFeedButton extends BaseElementMixin(HTMLButtonElement) {
  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'click', this.onButtonClick);
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  onButtonClick() {
    if (this.controlledElement) this.controlledElement.show();
  }
}
customElements.define('social-feed-button', SocialFeedButton, { extends: 'button' });

class IconsCarousel extends BaseElementMixin(HTMLDivElement) {
  constructor() {
    super();

    this.onUpdateTabindex();

    this.onUpdateTabindex = this.onUpdateTabindex.bind(this);
    this.onEnterListener = this.onEnterHandler.bind(this);
    this.onLeaveListener = this.onLeaveHandler.bind(this);
  }

  get isScrollable() {
    const style = window.getComputedStyle(this);
    const hasScrollableOverflow = style.overflow === 'scroll' || style.overflow === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'auto';
    const hasScrollableContent = this.scrollHeight > this.clientHeight || this.scrollWidth > this.clientWidth;

    return hasScrollableOverflow && hasScrollableContent;
  }

  connectedCallback() {
    super.connectedCallback();

    if (theme.config.isTouch) return;

    this.on(this, 'mouseenter', this.onEnterListener);
    this.on(this, 'mouseleave', this.onLeaveListener);
    this.on(document, 'matchSmall', this.onUpdateTabindex);
    this.on(document, 'unmatchSmall', this.onUpdateTabindex);
  }

  onEnterHandler() {
    const scrollWidth = this.scrollWidth * (theme.config.rtl ? -1 : 1);
    this.scrollTo({
      left: scrollWidth,
      behavior: theme.config.motionReduced ? 'auto' : 'smooth'
    });
  }

  onLeaveHandler() {
    this.scrollTo({
      left: 0,
      behavior: theme.config.motionReduced ? 'auto' : 'smooth'
    });
  }

  onUpdateTabindex() {
    this.removeAttribute('tabindex');

    if (this.isScrollable) {
      this.setAttribute('tabindex', '0');
    }
  }
}
customElements.define('icons-carousel', IconsCarousel, { extends: 'div' });

class ComparisonTable extends BaseElement {
  constructor() {
    super();

    this.highlighted = false;
    this.tableSticky = this.querySelector('.comparison-table__sticky');
    if (this.tableSticky) {
      Motion.inView(this, this.init.bind(this));
    }
  }

  get items() {
    return Array.from(this.querySelectorAll('.comparison-table__row'));
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.initialized) {
      this.initialized = false;
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.on(this, 'scroll', theme.utils.throttle(this.onScrollHandler.bind(this)));
    this.on(this.tableSticky, 'scroll', theme.utils.throttle(this.onStickyScrollHandler.bind(this)));

    const stopSticky = Motion.scroll(({ y }) => {
      if (y.current >= y.targetOffset + this.tableSticky.clientHeight / 2 && y.progress < 0.85) {
        this.tableSticky.classList.add('active');
      }
      else {
        this.tableSticky.classList.remove('active');
      }
    },
      { target: this, offset: ['0 start', 'end 0'] }
    );
    this.registerCleanup(stopSticky);
  }

  onScrollHandler(event) {
    this.tableSticky.scrollTo({
      left: event.target.scrollLeft
    });
  }

  onStickyScrollHandler(event) {
    this.scrollTo({
      left: event.target.scrollLeft
    });
  }

  highlight() {
    this.items.forEach((item) => {
      const classesToCheck = ['thead', 'tfoot', 'sticky'];
      if (classesToCheck.every(className => !item.classList.contains(className))) {
        if (this.highlighted) {
          const columns = Array.from(item.querySelectorAll('.comparison-table__column'));
          const first_column = columns[0];

          let highlighted = false;
          columns.forEach((column) => {
            if (first_column.innerHTML != column.innerHTML) {
              highlighted = true;
            }
          });

          item.classList.toggle('info', highlighted);
        }
        else {
          item.classList.remove('info');
        }
      }
    });
  }
}
customElements.define('comparison-table', ComparisonTable);

class ProductComparison extends BaseElementMixin(HTMLSelectElement) {
  connectedCallback() {
    super.connectedCallback();

    this.oldValue = this.value;
    this.on(this, 'change', this.onChange);
  }

  get sectionId() {
    return this.getAttribute('data-section-id');
  }

  get column() {
    return this.getAttribute('data-column');
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get items() {
    return Array.from(this.controlledElement.querySelectorAll('select[is="product-comparison"]'));
  }

  get selectedArr() {
    return this.items.map((item) => item !== this ? item.value : this.oldValue);
  }

  onChange() {
    const index = this.selectedArr.indexOf(this.value);
    if (index !== -1) {
      this.changeSelected(this.value);

      const sibling = this.items[index];
      if (sibling) {
        sibling.value = this.oldValue;
        sibling.dispatchEvent(new Event('change'));
      }
    }
    else {
      this.changeSelected(this.value);
    }
    this.oldValue = this.value;
  }

  changeSelected(productId) {
    const blockJSON = theme.ProductComparisonJSON[this.sectionId]?.[productId];
    if (typeof blockJSON === 'undefined') return;

    const column = this.items.indexOf(this) + 1;

    for (let index = 1; index <= 25; index++) {
      const element = this.controlledElement.querySelector(`[data-column="${column}"][data-index="${index}"]`);
      if (element) {
        const heading = blockJSON[`heading_${index}`];
        const value = blockJSON[`value_${index}`];
        element.innerHTML = heading.length ? `<p class="h6 leading-tight tracking-none">${heading}</p>${this.unescape(value)}` : this.unescape(value);
      }
    }

    const product = this.controlledElement.querySelector(`[data-product="${column}"]`);
    if (product) {
      product.innerHTML = document.getElementById(`ProductComparisonInfo-${this.sectionId}-${productId}`).innerHTML;
    }

    const productSticky = this.controlledElement.querySelector(`[data-product-sticky="${column}"]`);
    if (productSticky) {
      productSticky.innerHTML = document.getElementById(`ProductComparisonInfo-${this.sectionId}-${productId}`).innerHTML;
    }

    const productAction = this.controlledElement.querySelector(`[data-product-action="${column}"]`);
    if (productAction) {
      productAction.innerHTML = document.getElementById(`ProductComparisonAction-${this.sectionId}-${productId}`).innerHTML;
    }

    if (this.controlledElement) {
      this.controlledElement.highlight();
    }
  }

  unescape(input) {
    const doc = new DOMParser().parseFromString(input, 'text/html');
    return doc.documentElement.textContent;
  }
}
customElements.define('product-comparison', ProductComparison, { extends: 'select' });

class ComparisonHighlight extends BaseElementMixin(HTMLInputElement) {
  connectedCallback() {
    super.connectedCallback();

    this.on(this, 'change', this.onChange);
  }

  get controlledElement() {
    return this.hasAttribute('aria-controls') ? document.getElementById(this.getAttribute('aria-controls')) : null;
  }

  get items() {
    return Array.from(this.controlledElement.querySelectorAll('.comparison-table__row'));
  }

  onChange() {
    if (this.controlledElement) {
      this.controlledElement.highlighted = this.checked;
      this.controlledElement.highlight();
    }
  }
}
customElements.define('comparison-highlight', ComparisonHighlight, { extends: 'input' });

class ScrollSpy extends BaseElement {

  get scrollspyLinks() {
    return Array.from(this.querySelectorAll('.scrollspy-link'));
  }

  get backToTopButton() {
    return this.querySelector('.back-to-top');
  }

  get headerHeight() {
    let header = document.querySelector('.header-section header[is="sticky-header"]');
    if (this.hasAttribute('aria-controls')) {
      header = document.getElementById(this.getAttribute('aria-controls'));
    }
    return header ? (header.getBoundingClientRect().height + this.topGap) : (this.offsetHeight < window.innerHeight ? this.topGap : 0);
  }

  get topGap() {
    return this.hasAttribute('data-gap') ? parseInt(this.getAttribute('data-gap')) : 20;
  }

  get showHighlight() {
    return this.hasAttribute('data-highlight');
  }

  connectedCallback() {
    super.connectedCallback();

    this.scrollspyLinks.forEach(link => {
      this.on(link, 'click', this.handleScrollspyLinkClick.bind(this));
    });

    if (this.backToTopButton) {
      this.on(this.backToTopButton, 'click', this.handleBackToTopClick.bind(this));
    }

    if (this.showHighlight) {
      const onScroll = theme.utils.throttle(this.updateActiveLink.bind(this));
      this.on(window, 'scroll', onScroll, { passive: true });
      this.registerCleanup(() => onScroll.cancel());
      this.updateActiveLink();
    }
  }

  handleScrollspyLinkClick(event) {
    event.preventDefault();
    const link = event.currentTarget;

    const targetIds = link.hasAttribute('data-target') ? link.getAttribute('data-target').split(',') : [];
    const section = document.getElementById(targetIds[0]);

    if (section) {
      const sectionTop = window.scrollY + section.getBoundingClientRect().top - this.headerHeight;
      window.scrollTo({
        top: sectionTop,
        behavior: theme.config.motionReduced ? 'auto' : 'smooth'
      });
    }
  }

  handleBackToTopClick() {
    window.scrollTo({
      top: 0,
      behavior: theme.config.motionReduced ? 'auto' : 'smooth'
    });
  }

  updateActiveLink() {
    let current = '';

    this.scrollspyLinks.forEach(link => {
      const targetIds = link.hasAttribute('data-target') ? link.getAttribute('data-target').split(',') : [];

      targetIds.forEach((targetId) => {
        const section = document.getElementById(targetId);

        if (section) {
          const offset = 0;
          const sectionTop = section.offsetTop - offset;
          const sectionBottom = sectionTop + section.offsetHeight;

          if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionBottom) {
            current = targetId;
          }
        }
      });
    });

    this.scrollspyLinks.forEach(link => {
      const targetIds = link.hasAttribute('data-target') ? link.getAttribute('data-target').split(',') : [];
      let active = false;

      targetIds.forEach((targetId) => {
        if (targetId !== '' && targetId === current) {
          active = true;
        }
      });

      if (active) {
        link.setAttribute('aria-current', 'location');
        link.classList.add('active');
      }
      else {
        link.removeAttribute('aria-current');
        link.classList.remove('active');
      }
    });
  }
};
customElements.define('scroll-spy', ScrollSpy, { extends: 'nav' });
