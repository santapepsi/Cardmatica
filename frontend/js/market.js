// Real offers on Cardmática: what sellers put on sale from "Mi stock"
// (stock.js), read from /api/v1/listings (backend/app/api/listings.py).
//
// They show in three places: under each card of the catalogue, in the
// "Vendedores" tab above the demo stores, and in each seller's window. Prices
// are kept in the seller's currency and shown in the visitor's, with the same
// exchange rates as the rest of the storefront (frontend/demo/data.js).
// Buying them comes with orders; until then they are shown, not sold.
import { escapeHtml, html } from "./html.js";
import { t } from "./lang.js";
import { request } from "./session-api.js";
import { finishName } from "./catalog-view.js";

const h = escapeHtml;
export const LISTINGS = "/api/v1/listings";
// Offers asked for in the last half minute are not asked for again.
const FRESH_MS = 30_000;
const cache = new Map();

export async function offers(params) {
    const query = new URLSearchParams(params).toString();
    const kept = cache.get(query);
    if (kept && Date.now() - kept.at < FRESH_MS) return kept.rows;
    const rows = await request(`${LISTINGS}?${query}`);
    cache.set(query, { at: Date.now(), rows });
    return rows;
}

// After a seller changes their stock, everyone's lists are asked for again.
export function forgetOffers() {
    cache.clear();
}

// The storefront's currencies say how many of each make one euro.
function inEuros(listing) {
    const rate = window.CURRENCIES.find((item) => item.code === listing.currency)?.perEuro || 1;
    return Number(listing.price) / rate;
}

export const priceHtml = (listing) => window.formatPrice(inEuros(listing));

export function conditionHtml(code) {
    const condition = window.DEMO.conditions.find((item) => item.code === code);
    return `<span class="cond" style="background:${condition.color}" title="${h(t(condition.name))}">${code}</span>`;
}

export const languageText = (code) => (window.DEMO.languages[code] ? t(window.DEMO.languages[code].name) : code);

// "Foil", "Reverse"...: the finish, when the printing has more than one.
export const finishText = (finish) => (finish ? ` · ${h(finishName(finish))}` : "");

// A flag only for a seller who said their country (the demo ones always have).
const flagHtml = (country) => (country && window.DEMO.flags[country] ? window.flag(country) : "");

const sellerHtml = (seller) =>
    `${flagHtml(seller.country)}<button class="lk" data-real-seller="${h(seller.id)}">${h(seller.name)}</button>`;

// ---- Under a card: its offers, the shown printing's first -------------------

function cardOfferRow(listing) {
    const comment = listing.comment ? `<small>${h(listing.comment)}</small>` : "";
    return html`
        <tr>
            <td>${sellerHtml(listing.seller)}<small>${t("Desde {year}", { year: listing.seller.since })}</small></td>
            <td>
                <b>${h(listing.code)}</b> ${conditionHtml(listing.condition)} ${languageText(listing.language)}${finishText(listing.finish)}
                <small>${h(listing.set_name)} · ${h(listing.rarity)}</small>
                ${comment}
            </td>
            <td class="num price">${priceHtml(listing)}<small>${t("{count} disp.", { count: listing.quantity })}</small></td>
        </tr>`;
}

let shownCard = null;

export async function fillCardOffers(cardId, printingId) {
    shownCard = { cardId, printingId };
    const body = document.querySelector("#mb .cd-offers tbody");
    if (!body) return;
    let rows;
    try {
        rows = await offers({ card_id: cardId });
    } catch {
        return;
    }
    if (shownCard?.cardId !== cardId || !document.contains(body) || !rows.length) return;
    const first = (listing) => (listing.printing_id === printingId ? 0 : 1);
    rows = [...rows].sort((a, b) => first(a) - first(b) || inEuros(a) - inEuros(b));
    body.innerHTML = rows.map(cardOfferRow).join("");
}

// ---- The "Vendedores" tab: real sellers above the demo stores ----------------

function sellersOf(rows) {
    const sellers = new Map();
    for (const listing of rows) {
        const entry = sellers.get(listing.seller.id) || { ...listing.seller, listings: 0, units: 0, value: 0 };
        entry.listings += 1;
        entry.units += listing.quantity;
        entry.value += listing.quantity * inEuros(listing);
        sellers.set(listing.seller.id, entry);
    }
    return [...sellers.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function sellerRow(seller) {
    return html`
        <tr class="row real-seller" tabindex="0" data-real-seller="${h(seller.id)}">
            <td>
                ${flagHtml(seller.country)}<b class="lk">${h(seller.name)}</b>
                <small>${t("Desde {year}", { year: seller.since })} · <span class="real-tag">${t("Vendedor real")}</span></small>
            </td>
            <td class="hide">${seller.country ? t(seller.country) : "—"}</td>
            <td title="${t("Todavía sin valoraciones")}">${t("Nuevo")}</td>
            <td class="num">${seller.listings}</td>
            <td class="num hide">${seller.units}</td>
            <td class="num price">${window.formatPrice(seller.value)}</td>
        </tr>`;
}

export async function addRealSellers(list) {
    const game = window.game;
    let rows;
    try {
        rows = await offers({ game });
    } catch {
        return;
    }
    if (window.tab !== "Vendedores" || window.game !== game) return;
    list.querySelectorAll(".real-seller").forEach((row) => row.remove());
    list.insertAdjacentHTML("afterbegin", sellersOf(rows).map(sellerRow).join(""));
}

// ---- One seller's window -----------------------------------------------------

function inventoryRow(listing) {
    return html`
        <tr>
            <td>
                <button class="lk" data-catalog-card="${h(listing.card_id)}">${h(listing.card_name)}</button>
                ${listing.comment ? `<small>${h(listing.comment)}</small>` : ""}
            </td>
            <td><b>${h(listing.code)}</b><small>${h(listing.set_name)} · ${h(listing.rarity)}</small></td>
            <td>${conditionHtml(listing.condition)}</td>
            <td>${languageText(listing.language)}${finishText(listing.finish)}</td>
            <td class="num">${listing.quantity}</td>
            <td class="num price">${priceHtml(listing)}</td>
        </tr>`;
}

let openSeller = null;

export async function openRealSeller(id) {
    openSeller = id;
    const dialog = document.getElementById("md");
    dialog.dataset.mode = "real-seller";
    dialog.dataset.id = id;
    const box = document.getElementById("mb");
    box.innerHTML = `<div class="top"><h2>${t("Cargando…")}</h2><button class="ghost" data-close="md">${t("Cerrar")}</button></div>`;
    window.alignDialogs();
    dialog.classList.add("on");
    let rows;
    try {
        rows = await offers({ seller_id: id, game: window.game });
    } catch (error) {
        box.querySelector("h2").textContent = error.message;
        return;
    }
    if (openSeller !== id || dialog.dataset.mode !== "real-seller") return;
    const [seller] = sellersOf(rows);
    if (!seller) {
        box.querySelector("h2").textContent = t("Este vendedor no tiene artículos con esos filtros.");
        return;
    }
    box.innerHTML = html`
        <div class="top">
            <div>
                <h2>${flagHtml(seller.country)}${h(seller.name)}</h2>
                <small>${seller.country ? `${t(seller.country)} · ` : ""}${t("vendedor desde {year}", { year: seller.since })}</small>
            </div>
            <button class="ghost" data-close="md">${t("Cerrar")}</button>
        </div>
        <div class="facts" style="margin-bottom:10px">
            <div><span>${t("Artículos")}</span>${seller.listings}</div>
            <div><span>${t("Unidades en stock")}</span>${seller.units}</div>
            <div><span>${t("Valor del inventario")}</span><b>${window.formatPrice(seller.value)}</b></div>
        </div>
        <p class="catalog-status">${t("Las ofertas de vendedores reales se podrán comprar cuando lleguen los pedidos.")}</p>
        <div class="wrap">
            <table>
                <thead>
                    <tr>
                        <th>${t("Carta")}</th>
                        <th>${t("Impresión")}</th>
                        <th>${t("Estado")}</th>
                        <th>${t("Idioma")}</th>
                        <th class="num">${t("Disp.")}</th>
                        <th class="num">${t("Precio")}</th>
                    </tr>
                </thead>
                <tbody>${rows.map(inventoryRow).join("")}</tbody>
            </table>
        </div>`;
}

export function installMarket() {
    // The demo store draws its sellers; the real ones go on top.
    const drawSellers = window.renderSellers;
    window.renderSellers = function (...args) {
        drawSellers(...args);
        addRealSellers(document.getElementById("vl"));
    };
    // A new currency redraws the prices of what is open.
    const refreshPrices = window.refreshPrices;
    window.refreshPrices = function (...args) {
        refreshPrices(...args);
        const dialog = document.getElementById("md");
        if (!dialog.classList.contains("on")) return;
        if (dialog.dataset.mode === "real-seller") openRealSeller(dialog.dataset.id);
        if (dialog.dataset.mode === "catalog" && shownCard) fillCardOffers(shownCard.cardId, shownCard.printingId);
    };
    document.addEventListener("click", (event) => {
        const target = event.target.closest("[data-real-seller]");
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openRealSeller(target.dataset.realSeller);
    }, true);
    document.addEventListener("keydown", (event) => {
        const row = event.target.closest?.("tr[data-real-seller]");
        if (row && event.key === "Enter") openRealSeller(row.dataset.realSeller);
    });
}
