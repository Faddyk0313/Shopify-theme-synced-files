(function () {
  var ENDPOINT = "https://back-in-stock-dashboard.vercel.app/api/webhooks/notifyme-events";
  var DEBUG_FLAG = "__BIS_DEBUG__";

  function debug() {
    if (!window[DEBUG_FLAG]) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[BIS Tracker]");
    console.log.apply(console, args);
  }

  function toStringSafe(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function getProductInfoElement() {
    return document.querySelector("product-info[data-product-id][form]");
  }

  function getProductForm(productInfoEl) {
    if (!productInfoEl) return null;
    var formId = productInfoEl.getAttribute("form");
    if (!formId) return null;
    return document.getElementById(formId);
  }

  function parseJsonScriptById(id) {
    var node = document.getElementById(id);
    if (!node || !node.textContent) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      debug("Failed to parse JSON script", id, error);
      return null;
    }
  }

  function normalizeVariant(variant) {
    if (!variant || !variant.id) return null;
    var normalized = Object.assign({}, variant);
    normalized.id = toStringSafe(variant.id);
    return normalized;
  }

  function extractSize(variant, productJson) {
    if (!variant) return "";

    var options = Array.isArray(productJson && productJson.options) ? productJson.options : [];
    var sizeIndex = options.findIndex(function (name) {
      return toStringSafe(name).toLowerCase().indexOf("size") !== -1;
    });

    if (sizeIndex >= 0) {
      var key = "option" + (sizeIndex + 1);
      var explicit = variant[key];
      if (explicit !== undefined && explicit !== null && explicit !== "") {
        return toStringSafe(explicit);
      }
      if (Array.isArray(variant.options) && variant.options[sizeIndex] !== undefined) {
        return toStringSafe(variant.options[sizeIndex]);
      }
    }

    if (Array.isArray(variant.options) && variant.options.length > 0) {
      return toStringSafe(variant.options[0]);
    }

    return toStringSafe(variant.title || "");
  }

  function postEvent(payload) {
    // only require event type + variant id
    if (!payload.event_type || !payload.variant_id) {
      debug("Skipped event due to missing required payload fields", payload);
      return;
    }

    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      keepalive: true,
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        debug("Sent event", payload, "status:", res.status);
      })
      .catch(function (error) {
        debug("Failed to send event", payload, error);
      });
  }

  function init() {
    if (!document.body.classList.contains("template-product")) return;

    var productInfoEl = getProductInfoElement();
    var productForm = getProductForm(productInfoEl);
    if (!productInfoEl || !productForm) return;

    var productId = toStringSafe(productInfoEl.getAttribute("data-product-id"));
    var productJson = parseJsonScriptById("ProductJson-" + productId) || {};

    var viewedVariantIds = new Set();
    var variantById = new Map();
    var pendingAtcVariantId = "";
    var atcLastSentAtByVariantId = new Map();

    if (Array.isArray(productJson.variants)) {
      productJson.variants.forEach(function (variant) {
        if (!variant || variant.id === undefined || variant.id === null) return;
        variantById.set(toStringSafe(variant.id), normalizeVariant(variant));
      });
    }

    function getVariantById(variantId) {
      var id = toStringSafe(variantId);
      if (!id) return null;
      return variantById.get(id) || null;
    }

    function getCurrentVariantFromDom() {
      var selectedVariantNode = productInfoEl.querySelector("[data-selected-variant]");
      if (selectedVariantNode && selectedVariantNode.textContent) {
        try {
          var parsed = JSON.parse(selectedVariantNode.textContent);
          return normalizeVariant(parsed);
        } catch (error) {
          debug("Failed parsing data-selected-variant", error);
        }
      }

      var idInput = productForm.querySelector('input[name="id"]');
      if (!idInput) return null;
      return getVariantById(idInput.value);
    }

    function buildPayload(eventType, variant) {
      if (!variant) return null;
      return {
        event_type: toStringSafe(eventType),
        timestamp: new Date().toISOString(),
        product_id: productId, // may be empty fallback, still accepted
        variant_id: toStringSafe(variant.id),
        size: toStringSafe(extractSize(variant, productJson))
      };
    }

    function trackView(variant) {
      var normalized = normalizeVariant(variant);
      if (!normalized || !normalized.id) return;
      if (viewedVariantIds.has(normalized.id)) {
        debug("Skipped duplicate view for variant", normalized.id);
        return;
      }
      viewedVariantIds.add(normalized.id);
      var payload = buildPayload("view", normalized);
      if (payload) postEvent(payload);
    }

    function trackAtc(variant) {
      var normalized = normalizeVariant(variant);
      if (!normalized || !normalized.id) return;
      var now = Date.now();
      var lastSentAt = atcLastSentAtByVariantId.get(normalized.id) || 0;
      if (now - lastSentAt < 1000) {
        debug("Skipped duplicate atc for variant", normalized.id);
        return;
      }
      atcLastSentAtByVariantId.set(normalized.id, now);
      var payload = buildPayload("atc", normalized);
      if (payload) postEvent(payload);
    }

    var initialVariant = getCurrentVariantFromDom();
    if (initialVariant) {
      trackView(initialVariant);
    }

    productForm.addEventListener("variant:change", function (event) {
      var detailVariant = event && event.detail ? event.detail.variant : null;
      var normalized = normalizeVariant(detailVariant) || getCurrentVariantFromDom();
      if (!normalized) return;
      variantById.set(normalized.id, normalized);
      trackView(normalized);
    });

    productForm.addEventListener(
      "submit",
      function () {
        var current = getCurrentVariantFromDom();
        if (!current) return;
        pendingAtcVariantId = toStringSafe(current.id);

        // fallback for cartType=page
        if (window.theme && window.theme.settings && window.theme.settings.cartType === "page") {
          trackAtc(current);
        }
      },
      true
    );

    document.addEventListener("ajaxProduct:added", function () {
      if (!pendingAtcVariantId) return;
      var variant = getVariantById(pendingAtcVariantId) || getCurrentVariantFromDom();
      pendingAtcVariantId = "";
      if (!variant) return;
      trackAtc(variant);
    });

    debug("Initialized", { productId: productId });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
