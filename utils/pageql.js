/**
 * pageQL.js
 *
 * Semantic page index with SQL-like querying.
 * Inject once. Query anytime. Stays live via MutationObserver.
 *
 * ─── Injection ────────────────────────────────────────────────────────────────
 * chrome.scripting.executeScript({ target: { tabId }, files: ["pageql.js"] })
 *
 * ─── SQL string syntax ────────────────────────────────────────────────────────
 * pageQL(`SELECT * FROM elements WHERE label = 'Username'`)
 * pageQL(`SELECT * FROM elements WHERE targetElement = 'button' AND state.visible = true`)
 * pageQL(`SELECT * FROM elements WHERE text = 'Login' LIMIT 1`)
 * pageQL(`SELECT * FROM elements WHERE label = 'Email' AND within = 'Billing' AND NOT state.disabled = true`)
 * pageQL(`SELECT * FROM elements WHERE targetElement = 'button' ORDER BY importance DESC LIMIT 5`)
 * pageQL(`SELECT * FROM elements WHERE label = 'Status' AND rowValue = 'Alice'`)
 *
 * ─── Object syntax ───────────────────────────────────────────────────────────
 * pageQL({ targetElement: "textbox",  label: "Username" })
 * pageQL({ targetElement: "button",   text: "Login",    state: { visible: true } })
 * pageQL({ targetElement: "checkbox", text: "Remember", state: { checked: false } })
 * pageQL({ targetElement: "cell",     label: "Status",  rowValue: "Alice" })
 * pageQL({ targetElement: "button",   not: { state: { disabled: true } }, occurrence: 1 })
 * pageQL({ targetElement: "textbox",  within: { text: "Billing" }, label: "Email" })
 *
 * ─── Index access ─────────────────────────────────────────────────────────────
 * pageQL.index           → all IndexRecord[]
 * pageQL.stats()         → { total, byType, lastUpdated, updateCount }
 * pageQL.refresh()       → force full rebuild
 *
 * ─── Returns ─────────────────────────────────────────────────────────────────
 * IndexRecord[] sorted by relevance (confidence × importance)
 *
 * Each record:
 * {
 *   uid:          string,       // stable id
 *   element:      HTMLElement,  // live DOM reference
 *   targetElement: string,      // button | textbox | dropdown | checkbox | ...
 *   tagName:      string,
 *   role:         string|null,
 *   text:         string,       // textContent
 *   label:        string|null,  // resolved label (label-for, wrapping, aria-labelledby)
 *   placeholder:  string|null,
 *   ariaLabel:    string|null,
 *   title:        string|null,
 *   value:        string|null,  // current input value
 *   state: {
 *     visible:   boolean,
 *     disabled:  boolean,
 *     checked:   boolean,
 *     selected:  boolean,
 *     expanded:  boolean,
 *     empty:     boolean,
 *   },
 *   boundingBox:  { x, y, width, height },
 *   importance:   number,        // 0–1
 *   container:    string|null,   // nearest named ancestor heading/legend text
 *   domOrder:     number,        // position in document
 * }
 */

;(function (window) {
  "use strict";

  // ─── Config ─────────────────────────────────────────────────────────────────

  const INTERACTIVE_SELECTOR = [
    "button", "a[href]", "input", "select", "textarea",
    "summary", "[role=button]", "[role=link]", "[role=tab]",
    "[role=menuitem]", "[role=option]", "[role=checkbox]",
    "[role=radio]", "[role=switch]", "[role=combobox]",
    "[role=listbox]", "[role=slider]", "[role=spinbutton]",
    "[role=searchbox]", "[role=textbox]", "[role=dialog]",
    "[role=alertdialog]", "[role=alert]", "[role=status]",
    "[role=columnheader]", "[role=rowheader]", "[role=cell]",
    "th", "td[onclick]", "label",
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");

  // ─── Index state ─────────────────────────────────────────────────────────────

  let _index       = [];      // IndexRecord[]
  let _updateCount = 0;
  let _lastUpdated = null;
  let _domOrder    = 0;
  let _rebuildTimer = null;

  // ─── Semantic type detection ─────────────────────────────────────────────────

  function detectType(el) {
    const tag  = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    const type = el.getAttribute("type")?.toLowerCase();

    if (role === "button" || tag === "button" || type === "submit" || type === "button") return "button";
    if (role === "link"   || (tag === "a" && el.href)) return "link";
    if (role === "checkbox" || type === "checkbox")    return "checkbox";
    if (role === "radio"    || type === "radio")       return "radio";
    if (role === "switch")                             return "toggle";
    if (role === "tab")                                return "tab";
    if (role === "combobox" || role === "listbox" || tag === "select") return "dropdown";
    if (role === "slider")                             return "slider";
    if (role === "searchbox" || type === "search")     return "search";
    if (role === "dialog" || role === "alertdialog")   return "modal";
    if (role === "alert" || role === "status")         return "toast";
    if (role === "columnheader" || tag === "th")       return "columnheader";
    if (role === "cell" || tag === "td")               return "cell";
    if (role === "textbox" || type === "password")     return type === "password" ? "password" : "textbox";
    if (tag === "textarea")                            return "textarea";
    if (tag === "input")                               return "textbox";
    if (tag === "summary")                             return "accordion";
    if (el.getAttribute("aria-expanded") !== null)     return "accordion";
    return "other";
  }

  // ─── Label resolution ─────────────────────────────────────────────────────────

  function resolveLabel(el) {
    // aria-labelledby
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const texts = labelledBy.split(" ")
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean);
      if (texts.length) return texts.join(" ");
    }

    // id referenced by a <label for="">
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) {
        const clone = label.cloneNode(true);
        clone.querySelectorAll("input,select,textarea").forEach(i => i.remove());
        const t = clone.textContent?.trim();
        if (t) return t;
      }
    }

    // wrapping <label>
    const parentLabel = el.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input,select,textarea").forEach(i => i.remove());
      const t = clone.textContent?.trim();
      if (t) return t;
    }

    // adjacent sibling text (for checkbox/radio)
    const sib = el.nextSibling;
    if (sib) {
      const t = (sib.nodeType === 3 ? sib.textContent : sib.textContent)?.trim();
      if (t) return t;
    }

    return null;
  }

  // ─── Container resolution ─────────────────────────────────────────────────────
  // Walk up the DOM to find the nearest named section heading or legend

  function resolveContainer(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      // fieldset > legend
      if (node.tagName === "FIELDSET") {
        const legend = node.querySelector("legend");
        if (legend?.textContent?.trim()) return legend.textContent.trim();
      }
      // section / article / div with a heading inside
      const heading = node.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > legend, :scope > caption");
      if (heading?.textContent?.trim()) return heading.textContent.trim();
      // aria-label on the container
      const al = node.getAttribute("aria-label");
      if (al?.trim()) return al.trim();
      // role=group or role=region with aria-labelledby
      const lby = node.getAttribute("aria-labelledby");
      if (lby) {
        const t = document.getElementById(lby)?.textContent?.trim();
        if (t) return t;
      }
      node = node.parentElement;
    }
    return null;
  }

  // ─── Importance scoring ──────────────────────────────────────────────────────

  function scoreImportance(el, box) {
    let s = 0;
    if (box.y < window.innerHeight)                                               s += 0.3;
    if (box.width > 80 && box.height > 30)                                        s += 0.2;
    if (/submit|login|checkout|confirm|save|continue|sign/i.test(el.textContent)) s += 0.3;
    if (!el.hasAttribute("disabled"))                                             s += 0.2;
    return Math.min(s, 1.0);
  }

  // ─── Build a single IndexRecord ───────────────────────────────────────────────

  function buildRecord(el, order) {
    const box    = el.getBoundingClientRect();
    const tag    = el.tagName.toLowerCase();
    const role   = el.getAttribute("role") || null;
    const type   = detectType(el);

    // Text — strip inner input values to get pure label text
    const clone = el.cloneNode(true);
    clone.querySelectorAll("input,select,textarea").forEach(i => i.remove());
    const text = clone.textContent?.trim() || "";

    const label       = resolveLabel(el);
    const placeholder = el.placeholder || null;
    const ariaLabel   = el.getAttribute("aria-label") || null;
    const title       = el.getAttribute("title") || null;
    const value       = el.value != null ? (el.value || null) : null;

    const state = {
      visible:  box.width > 0 && box.height > 0 &&
                getComputedStyle(el).display !== "none" &&
                getComputedStyle(el).visibility !== "hidden",
      disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
      checked:  el.checked  === true || el.getAttribute("aria-checked")  === "true",
      selected: el.selected === true || el.getAttribute("aria-selected") === "true",
      expanded: el.getAttribute("aria-expanded") === "true" || el.open === true,
      empty:    (el.value ?? "").trim() === "",
    };

    const uid = el.id
      ? `e_${el.id}`
      : el.getAttribute("data-testid")
        ? `e_${el.getAttribute("data-testid")}`
        : `e_${Math.random().toString(36).slice(2, 8)}`;

    return {
      uid,
      element:       el,
      targetElement: type,
      tagName:       tag,
      role,
      text,
      label,
      placeholder,
      ariaLabel,
      title,
      value,
      state,
      boundingBox:   { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
      importance:    scoreImportance(el, box),
      container:     resolveContainer(el),
      domOrder:      order,
    };
  }

  // ─── Build full index ─────────────────────────────────────────────────────────

  function buildIndex() {
    _domOrder = 0;
    const records = [];
    const seen    = new Set();

    for (const el of document.querySelectorAll(INTERACTIVE_SELECTOR)) {
      if (seen.has(el)) continue;
      seen.add(el);
      try {
        records.push(buildRecord(el, _domOrder++));
      } catch { /* skip malformed elements */ }
    }

    _index       = records;
    _updateCount++;
    _lastUpdated = Date.now();
  }

  // ─── Incremental update on DOM change ────────────────────────────────────────

  function handleMutation(mutations) {
    let needsRebuild = false;

    for (const m of mutations) {
      // Added nodes — check if any are interactive or contain interactive elements
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.(INTERACTIVE_SELECTOR)) { needsRebuild = true; break; }
        if (node.querySelector?.(INTERACTIVE_SELECTOR)) { needsRebuild = true; break; }
      }
      if (needsRebuild) break;

      // Removed nodes
      for (const node of m.removedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.(INTERACTIVE_SELECTOR) ||
            node.querySelector?.(INTERACTIVE_SELECTOR)) {
          needsRebuild = true; break;
        }
      }
      if (needsRebuild) break;

      // Attribute changes on existing indexed elements
      if (m.type === "attributes" && m.target) {
        const el  = m.target;
        const rec = _index.find(r => r.element === el);
        if (rec) {
          // Hot-update just this record's state — cheaper than full rebuild
          const box = el.getBoundingClientRect();
          rec.state.disabled = el.disabled === true || el.getAttribute("aria-disabled") === "true";
          rec.state.checked  = el.checked  === true || el.getAttribute("aria-checked")  === "true";
          rec.state.selected = el.selected === true || el.getAttribute("aria-selected") === "true";
          rec.state.expanded = el.getAttribute("aria-expanded") === "true";
          rec.state.visible  = box.width > 0 && box.height > 0;
          rec.state.empty    = (el.value ?? "").trim() === "";
          rec.value          = el.value != null ? (el.value || null) : null;
          rec.boundingBox    = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
          _lastUpdated = Date.now();
        }
      }
    }

    if (needsRebuild) {
      // Debounce — coalesce rapid DOM changes into one rebuild
      clearTimeout(_rebuildTimer);
      _rebuildTimer = setTimeout(buildIndex, 100);
    }
  }

  // ─── SQL parser ───────────────────────────────────────────────────────────────
  // Parses a SQL-like string into the same query object the engine uses.
  //
  // Supported:
  //   SELECT * FROM elements WHERE <conditions> [ORDER BY <field> [ASC|DESC]] [LIMIT n]
  //
  // Conditions:
  //   field = 'value'
  //   field != 'value'
  //   state.field = true|false
  //   NOT state.field = true|false
  //   AND (all conditions are ANDed)

  function parseSQL(sql) {
    const query = {};

    // LIMIT
    const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) query.limit = parseInt(limitMatch[1]);

    // ORDER BY
    const orderMatch = sql.match(/\bORDER\s+BY\s+(\w+(?:\.\w+)?)\s*(ASC|DESC)?/i);
    if (orderMatch) {
      query.orderBy  = orderMatch[1];
      query.orderDir = (orderMatch[2] || "ASC").toUpperCase();
    }

    // WHERE clause
    const whereMatch = sql.match(/\bWHERE\b(.+?)(?:\bORDER\b|\bLIMIT\b|$)/is);
    if (!whereMatch) return query;

    const where = whereMatch[1].trim();
    // Split on AND (not inside quotes)
    const conditions = where.split(/\bAND\b/i);

    for (let cond of conditions) {
      cond = cond.trim();
      if (!cond) continue;

      const isNot = /^\bNOT\b/i.test(cond);
      if (isNot) cond = cond.replace(/^\bNOT\b\s*/i, "").trim();

      // state.field = value
      const stateMatch = cond.match(/^state\.(\w+)\s*=\s*(.+)$/i);
      if (stateMatch) {
        const field = stateMatch[1];
        const val   = parseValue(stateMatch[2]);
        if (isNot) {
          if (!query.not)       query.not = {};
          if (!query.not.state) query.not.state = {};
          query.not.state[field] = val;
        } else {
          if (!query.state) query.state = {};
          query.state[field] = val;
        }
        continue;
      }

      // within.text / within.role / within.selector
      const withinMatch = cond.match(/^within(?:\.(\w+))?\s*=\s*(.+)$/i);
      if (withinMatch) {
        const subField = withinMatch[1] || "text";
        if (!query.within) query.within = {};
        query.within[subField] = parseValue(withinMatch[2]);
        continue;
      }

      // after.text / after.role  or  before.text / before.role
      const afterMatch = cond.match(/^(after|before)(?:\.(\w+))?\s*=\s*(.+)$/i);
      if (afterMatch) {
        const dir      = afterMatch[1].toLowerCase();
        const subField = afterMatch[2] || "text";
        if (!query[dir]) query[dir] = {};
        query[dir][subField] = parseValue(afterMatch[3]);
        continue;
      }

      // occurrence = n
      const occMatch = cond.match(/^occurrence\s*=\s*(\-?\d+)$/i);
      if (occMatch) { query.occurrence = parseInt(occMatch[1]); continue; }

      // plain field = value  (text, label, placeholder, ariaLabel, title, rowValue, targetElement)
      const fieldMatch = cond.match(/^(\w+)\s*(!?=)\s*(.+)$/i);
      if (fieldMatch) {
        const field = fieldMatch[1];
        const op    = fieldMatch[2];
        const val   = parseValue(fieldMatch[3]);

        if (op === "!=" || isNot) {
          if (!query.not) query.not = {};
          query.not[field] = val;
        } else {
          query[field] = val;
        }
      }
    }

    return query;
  }

  function parseValue(raw) {
    const s = raw.trim().replace(/^['"]|['"]$/g, "");
    if (s === "true")  return true;
    if (s === "false") return false;
    if (/^\-?\d+$/.test(s)) return parseInt(s);
    return s;
  }

  // ─── Query engine ─────────────────────────────────────────────────────────────

  function runQuery(query) {
    let results = _index.slice(); // work on a copy

    // ── Filter: targetElement ──────────────────────────────────────────────────
    if (query.targetElement && query.targetElement !== "*") {
      results = results.filter(r => r.targetElement === query.targetElement);
    }

    // ── Filter: text identifiers ──────────────────────────────────────────────
    if (query.text !== undefined) {
      results = results.filter(r => matchField(r.text, query.text, query.exact));
    }
    if (query.label !== undefined && query.rowValue !== undefined) {
      // Table cell: label = column header, rowValue = row identifier
      results = results.filter(r => {
        if (r.targetElement !== "cell" && r.targetElement !== "columnheader") return false;
        // Find the column index of the header matching label
        const header = _index.find(h =>
          h.targetElement === "columnheader" && matchField(h.text, query.label, query.exact)
        );
        if (!header) return false;
        const colIndex = Array.from(header.element.parentElement?.children ?? []).indexOf(header.element);
        const table    = header.element.closest("table, [role=grid]");
        if (!table || colIndex < 0) return false;
        const rows = table.querySelectorAll("tr:not(:first-child), [role=row]:not(:first-child)");
        for (const row of rows) {
          const first = row.querySelector("td:first-child, [role=cell]:first-child");
          if (!first || !matchField(first.textContent?.trim(), query.rowValue, false)) continue;
          const cell = row.children[colIndex];
          return cell && cell === r.element;
        }
        return false;
      });
    } else if (query.label !== undefined) {
      results = results.filter(r => matchField(r.label, query.label, query.exact));
    }
    if (query.placeholder !== undefined) {
      results = results.filter(r => matchField(r.placeholder, query.placeholder, query.exact));
    }
    if (query.ariaLabel !== undefined) {
      results = results.filter(r => matchField(r.ariaLabel, query.ariaLabel, query.exact));
    }
    if (query.title !== undefined) {
      results = results.filter(r => matchField(r.title, query.title, query.exact));
    }
    if (query.nearbyText !== undefined) {
      results = results.filter(r => isNearText(r.element, query.nearbyText, query.exact));
    }

    // ── Filter: within (scope) ────────────────────────────────────────────────
    if (query.within) {
      const container = resolveRootElement(query.within);
      if (container) {
        results = results.filter(r => container.contains(r.element));
      }
    }

    // ── Filter: after / before ────────────────────────────────────────────────
    if (query.after) {
      const anchor = findAnchor(query.after);
      if (anchor) {
        results = results.filter(r => {
          const pos = anchor.compareDocumentPosition(r.element);
          return !!(pos & Node.DOCUMENT_POSITION_FOLLOWING);
        });
      }
    }
    if (query.before) {
      const anchor = findAnchor(query.before);
      if (anchor) {
        results = results.filter(r => {
          const pos = anchor.compareDocumentPosition(r.element);
          return !!(pos & Node.DOCUMENT_POSITION_PRECEDING);
        });
      }
    }

    // ── Filter: state ─────────────────────────────────────────────────────────
    const stateFilter = { visible: true, ...query.state };
    results = results.filter(r => matchState(r.state, stateFilter));

    // ── Filter: not ───────────────────────────────────────────────────────────
    if (query.not) {
      results = results.filter(r => {
        if (query.not.state && matchState(r.state, query.not.state)) return false;
        if (query.not.text  && matchField(r.text, query.not.text, false)) return false;
        if (query.not.label && matchField(r.label, query.not.label, false)) return false;
        return true;
      });
    }

    // ── Sort ──────────────────────────────────────────────────────────────────
    if (query.orderBy) {
      const dir = query.orderDir === "DESC" ? -1 : 1;
      results.sort((a, b) => {
        const av = getNestedField(a, query.orderBy);
        const bv = getNestedField(b, query.orderBy);
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
      });
    } else {
      // Default: sort by relevance (confidence of match × importance)
      results.sort((a, b) => b.importance - a.importance);
    }

    // ── Occurrence ────────────────────────────────────────────────────────────
    if (query.occurrence !== undefined) {
      const idx = query.occurrence === -1 ? results.length - 1 : query.occurrence - 1;
      results = results[idx] ? [results[idx]] : [];
    }

    // ── Limit ─────────────────────────────────────────────────────────────────
    if (query.limit !== undefined) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  // ─── Query helpers ────────────────────────────────────────────────────────────

  function matchField(actual, query, exact) {
    if (actual == null) return false;
    const a = actual.trim();
    const q = typeof query === "string" ? query : String(query);
    return exact ? a === q : a.toLowerCase().includes(q.toLowerCase());
  }

  function matchState(state, filter) {
    for (const [k, v] of Object.entries(filter)) {
      if (k in state && state[k] !== v) return false;
    }
    return true;
  }

  function getNestedField(obj, path) {
    return path.split(".").reduce((o, k) => o?.[k], obj);
  }

  function resolveRootElement(within) {
    if (within.selector) return document.querySelector(within.selector);
    if (within.role && !within.text) return document.querySelector(`[role="${within.role}"]`);
    if (within.text) {
      for (const h of document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading],legend,caption")) {
        if (matchField(h.textContent?.trim(), within.text, false)) {
          return h.closest("section,article,fieldset,form,dialog,[role=region],[role=group]")
              ?? h.parentElement;
        }
      }
    }
    return null;
  }

  function findAnchor(spec) {
    const sel = spec.role ? `[role="${spec.role}"]` : "h1,h2,h3,h4,h5,h6,[role=heading],button,a,label,span,p,td,th";
    for (const el of document.querySelectorAll(sel)) {
      if (matchField(el.textContent?.trim(), spec.text, false)) return el;
    }
    return null;
  }

  function isNearText(target, text, exact) {
    const tb = target.getBoundingClientRect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!matchField(node.textContent?.trim(), text, exact)) continue;
      const ab = node.parentElement?.getBoundingClientRect();
      if (!ab || ab.width === 0) continue;
      if (Math.hypot(ab.x - tb.x, ab.y - tb.y) <= 120) return true;
    }
    return false;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  function pageQL(input) {
    const query = typeof input === "string" ? parseSQL(input) : input;
    return runQuery(query);
  }

  pageQL.index   = _index;  // live reference — reflects current state
  pageQL.refresh = buildIndex;
  pageQL.stats   = function () {
    const byType = {};
    for (const r of _index) byType[r.targetElement] = (byType[r.targetElement] || 0) + 1;
    return {
      total:       _index.length,
      byType,
      lastUpdated: _lastUpdated,
      updateCount: _updateCount,
    };
  };

  // Expose on window
  window.pageQL = pageQL;

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  // Build index when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildIndex);
  } else {
    buildIndex();
  }

  // Full document observer — catches new elements added anywhere
  const fullObserver = new MutationObserver(handleMutation);
  fullObserver.observe(document.body, {
    childList:  true,
    subtree:    true,
    attributes: true,
    attributeFilter: [
      "disabled", "aria-disabled",
      "checked",  "aria-checked",
      "selected", "aria-selected",
      "aria-expanded",
      "hidden",   "aria-hidden",
      "value",    "placeholder",
      "aria-label", "aria-labelledby",
    ],
  });

})(window);
