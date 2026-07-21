if (!customElements.get('mobile-dock')) {
  customElements.define(
    'mobile-dock',
    class MobileDock extends BaseElement {
      connectedCallback() {
        super.connectedCallback();
    
        if (Shopify.designMode) {
          this.init();
        }
        else {
          new theme.initWhenVisible(theme.utils.throttle(this.init.bind(this)));
        }
      }
    
      get section() {
        return this._section = this._section || this.closest('.mobile-dock-section');
      }
    
      init() {
        if (this.initialized) return;
        this.initialized = true;
        this.setAttribute('loaded', '');
    
        this.detectForHeader();
        this.detectForFooter();
        setTimeout(this.setHeight.bind(this));
        this.on(document, 'matchSmall', this.setHeight.bind(this));
    
        if (Shopify.designMode) {
          this.on(this.section, 'shopify:section:select', () => {
            this.section.classList.add('shopify-active');
          });
          this.on(this.section, 'shopify:section:deselect', () => {
            this.section.classList.remove('shopify-active');
          });
        }
      }
    
      detectForHeader() {
        const header = document.querySelector('.header-section');
        if (header === null) {
          this.section.classList.add('active');
          return;
        }
        
        if (!header.classList.contains('header-sticky')) {
          this.scrollY = parseInt(header.getBoundingClientRect().bottom + window.scrollY);
          const onScroll = theme.utils.throttle(this.onScrollForHeader.bind(this));
          this.on(window, 'scroll', onScroll, { passive: true });
          this.registerCleanup(() => onScroll.cancel());
        }
      }
    
      onScrollForHeader() {
        if (window.scrollY >= this.scrollY) {
          this.section.classList.add('active');
        }
        else {
          this.section.classList.remove('active');
        }
      }
    
      detectForFooter() {
        const footer = document.querySelector('.footer-copyright');
        if (footer === null) return;
    
        const onScroll = theme.utils.throttle(this.onScrollForFooter.bind(this));
        this.on(window, 'scroll', onScroll, { passive: true });
        this.registerCleanup(() => onScroll.cancel());
      }
    
      onScrollForFooter() {
        if (!theme.config.mqlSmall) return;
        
        const scrolledTo = window.scrollY + window.innerHeight;
        const threshold = this.offsetHeight;
        const isReachBottom = document.body.scrollHeight - threshold <= scrolledTo;
        this.classList.toggle('active', isReachBottom);
      }
    
      setHeight() {
        document.documentElement.style.setProperty('--mobile-dock-height', `${this.getBoundingClientRect().height.toFixed(1)}px`);
      }
    }, { extends: 'nav' }
  );
}
