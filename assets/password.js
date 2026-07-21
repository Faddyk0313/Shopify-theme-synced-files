class PasswordMain extends HTMLElement {
  constructor() {
    super();

    if (this.sections.length == 1) {
      this.classList.add('with-section');
    }
  }

  get sections() {
    return this.querySelectorAll('.shopify-section');
  }
}
customElements.define('password-main', PasswordMain, { extends: 'main' });

class PasswordHeader extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.init();

    if (Shopify.designMode) {
      this.on(document, 'shopify:section:load', this.init.bind(this));
      this.on(document, 'shopify:section:unload', this.init.bind(this));
      this.on(document, 'shopify:section:reorder', this.init.bind(this));
    }
  }

  get allowTransparent() {
    if (document.querySelector('.shopify-section:last-child [allow-transparent-header]')) {
      return true;
    }

    return false;
  }

  get headerSection() {
    return document.querySelector('.password-header-section');
  }

  onSectionLoad(event) {
    theme.utils.shopifyEvent(event, this, this.init.bind(this));
  }

  init() {
    if (this.allowTransparent) {
      document.documentElement.classList.add('password-header-transparent');
      this.headerSection.classList.add('no-animate');

      setTimeout(() => {
        this.headerSection.classList.remove('no-animate');
      }, 500);
    }
    else {
      document.documentElement.classList.remove('password-header-transparent');
    }
  }
}
customElements.define('password-header', PasswordHeader, { extends: 'header' });

class PasswordFooter extends BaseElement {
  connectedCallback() {
    super.connectedCallback();

    this.init();

    if (Shopify.designMode) {
      this.on(document, 'shopify:section:load', this.init.bind(this));
      this.on(document, 'shopify:section:unload', this.init.bind(this));
      this.on(document, 'shopify:section:reorder', this.init.bind(this));
    }
  }

  get allowTransparent() {
    if (document.querySelector('.shopify-section:last-child [allow-transparent-footer]')) {
      return true;
    }

    return false;
  }

  get footerSection() {
    return document.querySelector('.password-footer-section');
  }

  onSectionLoad(event) {
    theme.utils.shopifyEvent(event, this, this.init.bind(this));
  }

  init() {
    if (this.allowTransparent) {
      document.documentElement.classList.add('password-footer-transparent');
      this.footerSection.classList.add('no-animate');

      setTimeout(() => {
        this.footerSection.classList.remove('no-animate');
      }, 500);
    }
    else {
      document.documentElement.classList.remove('password-footer-transparent');
    }
  }
}
customElements.define('password-footer', PasswordFooter, { extends: 'footer' });

class PasswordModal extends ModalElement {

  get shouldLock() {
    return true;
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.querySelector('input[aria-invalid="true"]')) {
      this.show();
    }
  }
}
customElements.define('password-modal', PasswordModal);
