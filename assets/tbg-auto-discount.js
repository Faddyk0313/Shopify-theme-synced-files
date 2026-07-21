// TBG Custom Code - Enhanced Debug Version
(function () {
  // Define collections and their corresponding discount codes
  const COLLECTIONS_CONFIG = [
    {
      handle: 'preorder-smart-collection',
      discountCode: 'PREORDER25',
      productIds: []
    },
    {
      handle: 'BACKORDER-discount-smart-collection-copy',
      discountCode: 'BACKORDER15',
      productIds: []
    }
  ];

  console.log('[TBG] Script loaded. Collections configured:', COLLECTIONS_CONFIG.map(c => `${c.handle} -> ${c.discountCode}`));

  // Fetch products from all configured collections
  async function fetchAllCollectionProducts() {
    try {
      const fetchPromises = COLLECTIONS_CONFIG.map(async (collection) => {
        try {
          const res = await fetch(`/collections/${collection.handle}/products.json?limit=250`, {
            credentials: 'same-origin'
          });

          if (!res.ok) {
            console.error(`[TBG] Failed to fetch collection ${collection.handle}, status:`, res.status);
            return;
          }

          const data = await res.json();
          collection.productIds = data.products ? data.products.map(p => p.id) : [];
          console.log(`[TBG] Fetched ${collection.productIds.length} product IDs from ${collection.handle}:`, collection.productIds);
        } catch (e) {
          console.error(`[TBG] Error fetching collection ${collection.handle}:`, e);
        }
      });

      await Promise.all(fetchPromises);
      console.log('[TBG] All collections fetched successfully');
    } catch (e) {
      console.error('[TBG] Error fetching collections:', e);
    }
  }

  // Get variant inventory from the DOM
  function getVariantInventory(productId, variantId) {
    try {
      const jsonElement = document.getElementById(`ProductJsonAdditional-${productId}`);
      if (!jsonElement) {
        console.log('[TBG] No ProductJsonAdditional found for product:', productId);
        return null;
      }

      const productData = JSON.parse(jsonElement.textContent);
      console.log('[TBG] Product data found for product', productId);

      const variant = productData.variants.find(v => v.id === Number(variantId));
      if (!variant) {
        console.log('[TBG] Variant not found:', variantId);
        return null;
      }

      console.log('[TBG] Variant inventory data:', {
        variant_id: variant.id,
        inventory_quantity: variant.inventory_quantity,
        available: variant.available
      });

      return variant.inventory_quantity;
    } catch (e) {
      console.error('[TBG] Error reading variant inventory:', e);
      return null;
    }
  }

  async function fetchCart() {
    const res = await fetch('/cart.js', { credentials: 'same-origin' });
    return res.json();
  }

  function findQualifyingItem(cart) {
    if (!cart || !Array.isArray(cart.items)) {
      console.log('[TBG] No cart or items array found');
      return null;
    }

    console.log('[TBG] Checking cart items:', cart.items.length);

    for (const item of cart.items) {
      console.log('[TBG] Item:', {
        product_id: item.product_id,
        variant_id: item.variant_id,
        title: item.title
      });

      // Check each collection to see if this product belongs to it
      for (const collection of COLLECTIONS_CONFIG) {
        const isEligible = collection.productIds.includes(Number(item.product_id));

        if (isEligible) {
          console.log('[TBG] Product ID', item.product_id, '- Found in collection:', collection.handle);

          // Check inventory from DOM
          const inventory = getVariantInventory(item.product_id, item.variant_id);
          console.log('[TBG] Variant', item.variant_id, 'inventory:', inventory);

          if (inventory !== null && inventory < 1) {
            console.log('[TBG] ✓ QUALIFYING ITEM FOUND! Product:', item.product_id, 'Collection:', collection.handle, 'Discount:', collection.discountCode);
            return {
              productId: item.product_id,
              variantId: item.variant_id,
              discountCode: collection.discountCode,
              collectionHandle: collection.handle
            };
          } else {
            console.log('[TBG] Product eligible but inventory check failed. Inventory:', inventory);
          }
        }
      }
    }

    console.log('[TBG] No qualifying items found');
    return null;
  }

  function alreadyHasDiscount(cart, discountCode) {
    console.log('[TBG] Checking existing discounts:', cart.discount_codes);
    if (Array.isArray(cart.discount_codes) && cart.discount_codes.some(dc => dc.code.toUpperCase() === discountCode.toUpperCase())) {
      console.log('[TBG] Discount already applied:', discountCode);
      return true;
    }
    return false;
  }

  async function checkAndApply() {
    console.log('[TBG] ========= CHECK AND APPLY TRIGGERED =========');
    try {
      // Fetch collection products if not already cached
      const needsFetch = COLLECTIONS_CONFIG.some(c => c.productIds.length === 0);
      if (needsFetch) {
        await fetchAllCollectionProducts();
      }

      const cart = await fetchCart();
      console.log('[TBG] Cart fetched:', cart);

      // Find qualifying item and its discount code
      const qualifyingItem = findQualifyingItem(cart);

      if (qualifyingItem) {
        const hasDiscount = alreadyHasDiscount(cart, qualifyingItem.discountCode);

        console.log('[TBG] Has discount:', hasDiscount, '| Qualifying item:', qualifyingItem);

        if (!hasDiscount) {
          console.log('[TBG] 🚀 REDIRECTING TO APPLY DISCOUNT:', qualifyingItem.discountCode);

          // Store timestamp in localStorage before redirect
          localStorage.setItem('tbg_discount_timestamp', Date.now().toString());

          // Get current page URL and add a flag to open cart drawer after redirect
          const currentPath = window.location.pathname + window.location.search;
          const separator = currentPath.includes('?') ? '&' : '?';
          const redirectPath = currentPath + separator + 'tbg_open_cart=1';

          console.log('[TBG] Current path:', currentPath);
          console.log('[TBG] Redirect path:', redirectPath);
          console.log('[TBG] Full redirect URL:', `/discount/${encodeURIComponent(qualifyingItem.discountCode)}?redirect=${encodeURIComponent(redirectPath)}`);

          window.location.href = `/discount/${encodeURIComponent(qualifyingItem.discountCode)}?redirect=${encodeURIComponent(redirectPath)}`;
        } else {
          console.log('[TBG] Discount already applied');
        }
      } else {
        console.log('[TBG] No qualifying items found - no redirect needed');
      }
    } catch (e) {
      console.error('[TBG] Discount check failed', e);
    }
  }

  // Run right after add-to-cart AJAX success
  document.addEventListener('cart:updated', function() {
    console.log('[TBG] cart:updated event fired');
    checkAndApply();
  });

  // Fallback: if your theme doesn't fire cart:updated, hook into add-to-cart buttons
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button[type="submit"], .product-form__submit, [name="add"], .add-to-cart');
    if (btn) {
      console.log('[TBG] Add to cart button clicked, waiting 1200ms...');
      setTimeout(checkAndApply, 1200); // wait for cart drawer to update
    }
  });

  // Additional fallback: listen for Shopify's native cart events
  if (typeof Shopify !== 'undefined' && Shopify.theme) {
    document.addEventListener('shopify:cart:change', function() {
      console.log('[TBG] shopify:cart:change event fired');
      checkAndApply();
    });
  }

  // Run once on page load if we're on the cart page
  if (window.location.pathname.includes('/cart')) {
    console.log('[TBG] On cart page, checking immediately');
    setTimeout(checkAndApply, 500);
  }

  // Open cart drawer after discount is applied and user returns to PDP
  function openCartDrawer() {
    console.log('[TBG] Attempting to open cart drawer...');

    const cartDrawer = document.getElementById('CartDrawer');

    if (cartDrawer) {
      // Remove hidden attribute and set open attribute
      cartDrawer.removeAttribute('hidden');
      cartDrawer.setAttribute('open', '');
      console.log('[TBG] Cart drawer opened - removed hidden, added open attribute');

      // Also add active class if needed
      cartDrawer.classList.add('active');
    } else {
      console.log('[TBG] CartDrawer element not found, trying cart icon click...');
      // Fallback: click the cart icon
      const cartIcon = document.querySelector('.header__icon--cart, [href="/cart"], .cart-link, #cart-icon-bubble');
      if (cartIcon) {
        cartIcon.click();
        console.log('[TBG] Cart drawer opened via cart icon click');
      }
    }
  }

  // Check URL parameter to see if we should open cart drawer
  const urlParams = new URLSearchParams(window.location.search);
  const hasOpenCartParam = urlParams.get('tbg_open_cart') === '1';

  console.log('[TBG] Current URL:', window.location.href);
  console.log('[TBG] Has tbg_open_cart param:', hasOpenCartParam);

  // Also check localStorage timestamp (fallback if URL param doesn't work)
  const discountTimestamp = localStorage.getItem('tbg_discount_timestamp');
  const timeSinceDiscount = discountTimestamp ? Date.now() - parseInt(discountTimestamp) : null;
  const recentlyAppliedDiscount = timeSinceDiscount !== null && timeSinceDiscount < 5000; // Within 5 seconds

  console.log('[TBG] Discount timestamp:', discountTimestamp);
  console.log('[TBG] Time since discount (ms):', timeSinceDiscount);
  console.log('[TBG] Recently applied discount:', recentlyAppliedDiscount);

  if (hasOpenCartParam || recentlyAppliedDiscount) {
    console.log('[TBG] Discount was just applied, opening cart drawer...');

    // Clear the timestamp
    if (recentlyAppliedDiscount) {
      localStorage.removeItem('tbg_discount_timestamp');
    }

    // Wait for page to fully load, then open drawer
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(openCartDrawer, 500);
      });
    } else {
      setTimeout(openCartDrawer, 500);
    }
  } else {
    console.log('[TBG] No need to open cart drawer');
  }
})();
// End TBG Custom Code
