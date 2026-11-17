// ---- PostHog init ----
(function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]));

// TBG Custom Code
// T4 (Phase 2): pixel events run inside Shopify's sandbox iframe, so posthog-js
// would log the sandbox address as $current_url. Remember the real page from each
// Shopify event (event.context.document) and stamp it on every outgoing event in
// before_send, so nothing sent from this pixel is missed ($identify included).
var tbgPage = null;

function tbgRememberPage(event) {
  try {
    var doc = event && event.context && event.context.document;
    var loc = doc && doc.location;
    if (loc && loc.href) {
      tbgPage = {
        href: loc.href,
        pathname: loc.pathname || null,
        host: loc.host || null,
        referrer: doc.referrer || ''
      };
    }
  } catch (e) {}
}

function tbgBeforeSend(ev) {
  try {
    if (ev && ev.properties && tbgPage) {
      ev.properties.$current_url = tbgPage.href;
      ev.properties.$pathname = tbgPage.pathname;
      ev.properties.$host = tbgPage.host;
      ev.properties.$referrer = tbgPage.referrer || '$direct';
      var refDomain = '$direct';
      try {
        if (tbgPage.referrer) refDomain = new URL(tbgPage.referrer).host;
      } catch (e) {}
      ev.properties.$referring_domain = refDomain;
    }
  } catch (e) {}
  return ev;
}
// End TBG Custom Code

posthog.init('phc_5OKb3d3E7BPOs78n9YNJ65ETjPSUyEI9YFcpj7Cil3x', {
  api_host: 'https://us.i.posthog.com',
  autocapture: false,
  disable_session_recording: true,
  capture_pageview: false,
  capture_pageleave: false,
  defaults: '2026-01-30',
  // TBG Custom Code
  before_send: tbgBeforeSend
  // End TBG Custom Code
});

// TBG Custom Code
// Keep the latest real page even for events this pixel does not capture.
analytics.subscribe('page_viewed', tbgRememberPage);

// T3 (Phase 2): line-item detail. Cart lines carry `merchandise`, checkout lines
// carry `variant`. Titan SKUs: STYLE-COLOR-AGE-SIZE[-B|-LEGACY], e.g.
// 1000184-002-YTH-LG, 1000064-101-YTH-XS-B (grade B, "(DEFECT)" titles),
// 1000185-007-SR-MD-LEGACY (SR variants listed under "YTH ELEVATE 3.0" products),
// 1000079-309-OSFA (hats), 1005001-225 (drinkware). Variant titles are either the
// size ("YTH-LG", "SR-SM/MD", "OSFA") or "Color / SIZE" ("Black / SR-SM").
var TBG_NON_APPAREL = ['Bottle', 'Tumbler', 'Gift Card', 'Sticker', 'Service'];

function tbgNum(value) {
  var n = Number(value);
  return value === null || value === undefined || value === '' || isNaN(n) ? null : n;
}

function tbgMapLine(line) {
  var v = (line && (line.merchandise || line.variant)) || {};
  var p = v.product || {};
  var sku = v.sku || '';
  var skuU = sku.toUpperCase();
  var title = p.title || (line && line.title) || '';
  var variantTitle = v.title || '';
  var productType = p.type || null;

  // Size: the YTH-/SR- token (or OSFA) from the variant title, else the variant title itself.
  var sizeMatch = variantTitle.toUpperCase().match(/\b((?:YTH|SR)-[A-Z0-9]+(?:\/[A-Z0-9]+)?|OSFA)\b/);
  var size = sizeMatch ? sizeMatch[1] : (variantTitle && variantTitle !== 'Default Title' ? variantTitle : null);

  // Age group: from the SKU first (reliable for legacy SR units), then the size, then the title prefix.
  var ageMatch = skuU.match(/-(YTH|SR)-/) || (size || '').match(/^(YTH|SR)-/) || title.toUpperCase().match(/^(YTH|SR)\b/);
  var ageGroup = ageMatch ? ageMatch[1] : null;

  // Colorway: "Color / SIZE" variants carry it in the variant title; otherwise the
  // product title suffix after " - ", minus "(DEFECT)". Custom team products and
  // non-apparel (drinkware, gift cards) have no colorway.
  var colorway = null;
  if (TBG_NON_APPAREL.indexOf(productType) === -1) {
    if (variantTitle.indexOf(' / ') > -1) {
      colorway = variantTitle.split(' / ')[0].trim().toUpperCase();
    } else if (title.indexOf(' - ') > -1) {
      var suffix = title.split(' - ').pop().replace(/\s*\(DEFECT\)\s*$/i, '').trim();
      if (suffix && !/CUSTOM/i.test(suffix)) colorway = suffix;
    }
  }

  var generationMatch = title.match(/\b(\d\.\d)\b/);

  return {
    product_id: p.id || null,
    variant_id: v.id || null,
    sku: sku || null,
    title: title || null,
    product_type: productType,
    age_group: ageGroup,
    size: size,
    colorway: colorway,
    generation: generationMatch ? generationMatch[1] : null,
    grade: /-B$/.test(skuU) ? 'B' : 'A',
    is_legacy: /-LEGACY$/.test(skuU),
    price: tbgNum(v.price && v.price.amount),
    quantity: line && line.quantity
  };
}

// products[] items: the new fields plus the original four keys with their original values.
function tbgProducts(lineItems) {
  return (lineItems || []).map(function (item) {
    var original = {
      product_id: item.variant?.product?.id,
      name: item.title,
      price: parseFloat(item.variant?.price?.amount),
      quantity: item.quantity
    };
    try {
      return Object.assign(tbgMapLine(item), original);
    } catch (e) {
      return original;
    }
  });
}

// Order-level fields shared by Checkout Started and Order Completed. No order_id
// here: Checkout Started keeps order_id = checkout token, Order Completed keeps
// order_id = order id.
function tbgCheckoutProps(checkout, products) {
  try {
    var c = checkout || {};
    var discountCodes = (c.discountApplications || [])
      .filter(function (d) { return d && d.type === 'DISCOUNT_CODE'; })
      .map(function (d) { return d.title; });
    return {
      checkout_token: c.token || null,
      total: tbgNum(c.totalPrice && c.totalPrice.amount),
      subtotal: tbgNum(c.subtotalPrice && c.subtotalPrice.amount),
      shipping: tbgNum(c.shippingLine && c.shippingLine.price && c.shippingLine.price.amount),
      tax: tbgNum(c.totalTax && c.totalTax.amount),
      discount_total: tbgNum(c.discountsAmount && c.discountsAmount.amount),
      discount_codes: discountCodes,
      total_line_items: (c.lineItems || []).length,
      total_items_quantity: (c.lineItems || []).reduce(function (sum, item) {
        return sum + (Number(item.quantity) || 0);
      }, 0),
      has_youth_item: products.some(function (p) { return p.age_group === 'YTH'; }),
      has_baselayer: products.some(function (p) { return p.product_type === 'Baselayer'; })
    };
  } catch (e) {
    return {};
  }
}

// T2 (Phase 2): identify the buyer by Shopify customer ID only (no eh_ IDs, no alias,
// no reset here). Only a SHA-256 hash of the email is sent, never the email itself.
async function tbgSha256(str) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str).trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

async function tbgIdentifyFromCheckout(checkout) {
  try {
    var rawId = checkout && checkout.order && checkout.order.customer && checkout.order.customer.id;
    if (!rawId) return;
    var customerId = String(rawId).split('/').pop();
    var setProps = { shopify_customer_id: customerId };
    try {
      if (checkout.email && typeof crypto !== 'undefined' && crypto.subtle) {
        setProps.email_hash = await tbgSha256(checkout.email);
      }
    } catch (e) {}
    posthog.identify('shopify_' + customerId, setProps, {
      first_seen_checkout_at: new Date().toISOString()
    });
  } catch (e) {}
}
// End TBG Custom Code

// ---- Product Added to Cart ----
analytics.subscribe('product_added_to_cart', (event) => {
  tbgRememberPage(event); // TBG Custom Code
  const item = event.data.cartLine;
  // TBG Custom Code
  let tbgLine = {};
  try {
    tbgLine = tbgMapLine(item);
  } catch (e) {}
  // End TBG Custom Code
  posthog.capture('Product Added', {
    ...tbgLine, // TBG Custom Code
    product_id: item.merchandise?.product?.id,
    name: item.merchandise?.product?.title,
    variant: item.merchandise?.title,
    price: parseFloat(item.merchandise?.price?.amount),
    quantity: item.quantity,
    currency: item.merchandise?.price?.currencyCode
  });
});

// ---- Checkout Started ----
analytics.subscribe('checkout_started', (event) => {
  tbgRememberPage(event); // TBG Custom Code
  const checkout = event.data.checkout;
  // TBG Custom Code
  const tbgItems = tbgProducts(checkout.lineItems);
  // End TBG Custom Code
  posthog.capture('Checkout Started', {
    ...tbgCheckoutProps(checkout, tbgItems), // TBG Custom Code
    order_id: checkout.token,
    value: parseFloat(checkout.totalPrice?.amount),
    currency: checkout.currencyCode,
    products: tbgItems // TBG Custom Code (same four keys as before, plus line-item detail)
  });
});

// TBG Custom Code
// Phase 2: never let the FX lookup hold up Order Completed. Abort after 1.5 s and
// send total_usd_estimated = null instead.
async function convertToUSD(amount, currency) {
  if (!amount || !currency) return null;
  if (currency === 'USD') return amount;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 1500) : null;
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${currency}`, controller ? { signal: controller.signal } : undefined);
    const data = await response.json();

    if (data && data.result === 'success' && data.rates && data.rates.USD) {
      return amount * data.rates.USD;
    }

    return null;
  } catch (error) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
// End TBG Custom Code

// ---- Order Completed ----
analytics.subscribe('checkout_completed', async (event) => {
  tbgRememberPage(event); // TBG Custom Code
  const checkout = event.data.checkout;
  const localTotal = parseFloat(checkout.totalPrice?.amount);
  const localCurrency = checkout.currencyCode;
  // TBG Custom Code
  // Start the FX lookup, identify the buyer while it runs, then capture.
  const usdPromise = convertToUSD(localTotal, localCurrency);
  await tbgIdentifyFromCheckout(checkout);
  const estimatedUsdTotal = await usdPromise;
  const tbgItems = tbgProducts(checkout.lineItems);
  // End TBG Custom Code

  // TBG Custom Code
  const totalLineItems = checkout.lineItems.length;

  const totalItemsQuantity = checkout.lineItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0);
  }, 0);
  // End TBG Custom Code

  posthog.capture('Order Completed', {
    ...tbgCheckoutProps(checkout, tbgItems), // TBG Custom Code
    order_id: checkout.order?.id,
    total: localTotal,
    currency: localCurrency,

    total_local: localTotal,
    currency_local: localCurrency,
    total_usd_estimated: estimatedUsdTotal,

    // TBG Custom Code
    total_line_items: totalLineItems,
    total_items_quantity: totalItemsQuantity,
    // End TBG Custom Code

    products: tbgItems // TBG Custom Code (same four keys as before, plus line-item detail)
  }, { send_instantly: true }); // TBG Custom Code: skip the batch queue so a quick exit does not drop the purchase
});
