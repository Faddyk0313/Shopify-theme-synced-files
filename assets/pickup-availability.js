if (!customElements.get('pickup-availability')) {
  customElements.define(
    'pickup-availability',
    class PickupAvailability extends BaseElement {
      connectedCallback() {
        super.connectedCallback();

        if (!this.hasAttribute('available')) return;

        this.errorHtml = this.errorHtml || this.querySelector('template').content.firstElementChild.cloneNode(true);
        this.onClickRefreshList = this.onClickRefreshList.bind(this);
        this.fetchAvailability(this.getAttribute('data-variant-id'));
      }

      fetchAvailability(variantId) {
        let rootUrl = this.getAttribute('data-root-url');
        if (!rootUrl.endsWith('/')) {
          rootUrl = rootUrl + '/';
        }
        const variantSectionUrl = `${rootUrl}variants/${variantId}/?section_id=pickup-availability`;

        this.availabilityAbortController?.abort();
        this.availabilityAbortController = new AbortController();

        fetch(variantSectionUrl, { signal: this.availabilityAbortController.signal })
          .then((response) => response.text())
          .then((responseText) => {
            const sectionInnerHTML = new DOMParser()
              .parseFromString(responseText, 'text/html')
              .querySelector('.shopify-section');
            this.renderPreview(sectionInnerHTML);
          })
          .catch((error) => {
            if (error.name === 'AbortError') return;

            this.renderError();
          });
      }

      onClickRefreshList() {
        this.fetchAvailability(this.getAttribute('data-variant-id'));
      }

      update(variant) {
        if (variant?.available) {
          this.fetchAvailability(variant.id);
        }
        else {
          this.innerHTML = '';
          this.removeAttribute('available');
          this.setAttribute('hidden', '');
        }
      }

      renderError() {
        this.innerHTML = '';
        this.appendChild(this.errorHtml);

        const button = this.querySelector('button');
        if (button) this.on(button, 'click', this.onClickRefreshList);
      }

      renderPreview(sectionInnerHTML) {
        const drawer = document.querySelector('.pickup-availability-drawer');
        if (drawer) drawer.remove();
        if (!sectionInnerHTML.querySelector('.pickup-availability-preview')) {
          this.innerHTML = '';
          this.removeAttribute('available');
          this.setAttribute('hidden', '');
          return;
        }

        this.innerHTML = sectionInnerHTML.querySelector('.pickup-availability-preview').outerHTML;
        this.removeAttribute('hidden');
        this.setAttribute('available', '');

        document.body.appendChild(sectionInnerHTML.querySelector('.pickup-availability-drawer'));
      }
    }
  );
}
