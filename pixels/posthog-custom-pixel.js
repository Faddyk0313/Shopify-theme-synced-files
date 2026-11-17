// ---- PostHog init ----  
(function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]));

posthog.init('phc_5OKb3d3E7BPOs78n9YNJ65ETjPSUyEI9YFcpj7Cil3x', {  
  api_host: 'https://us.i.posthog.com', 
  autocapture: false,
  disable_session_recording: true, 
  capture_pageview: false,
  capture_pageleave: false,  
  defaults: '2026-01-30'  
});

// ---- Product Added to Cart ----  
analytics.subscribe('product_added_to_cart', (event) => {  
  const item = event.data.cartLine;  
  posthog.capture('Product Added', {  
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
  const checkout = event.data.checkout;  
  posthog.capture('Checkout Started', {  
    order_id: checkout.token,  
    value: parseFloat(checkout.totalPrice?.amount),  
    currency: checkout.currencyCode,  
    products: checkout.lineItems.map(item => ({  
      product_id: item.variant?.product?.id,  
      name: item.title,  
      price: parseFloat(item.variant?.price?.amount),  
      quantity: item.quantity  
    }))  
  });  
});

// TBG Custom Code
async function convertToUSD(amount, currency) {
  if (!amount || !currency) return null;
  if (currency === 'USD') return amount;

  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
    const data = await response.json();

    if (data && data.result === 'success' && data.rates && data.rates.USD) {
      return amount * data.rates.USD;
    }

    return null;
  } catch (error) {
    return null;
  }
}

// ---- Order Completed ----
analytics.subscribe('checkout_completed', async (event) => {
  const checkout = event.data.checkout;
  const localTotal = parseFloat(checkout.totalPrice?.amount);
  const localCurrency = checkout.currencyCode;
  const estimatedUsdTotal = await convertToUSD(localTotal, localCurrency);

  // TBG Custom Code
  const totalLineItems = checkout.lineItems.length;

  const totalItemsQuantity = checkout.lineItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0);
  }, 0);
  // End TBG Custom Code

  posthog.capture('Order Completed', {
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

    products: checkout.lineItems.map(item => ({
      product_id: item.variant?.product?.id,
      name: item.title,
      price: parseFloat(item.variant?.price?.amount),
      quantity: item.quantity
    }))
  });
});