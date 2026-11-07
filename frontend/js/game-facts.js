// What the card window says of a Magic or Pokémon card (catalog-view.js draws
// the rest): the finishes each printing is sold in, what is printed on the
// card, and the formats where it may be played, which is what these games have
// in place of Yu-Gi-Oh!'s banlist. The data comes with each card (Scryfall, TCGdex).
import { MAGIC_COLORS, MAGIC_TYPES, pokemonWord, typeLine } from "./card-types.js";
import { escapeHtml, html } from "./html.js";
import { t } from "./lang.js";

const h = escapeHtml;

// Finishes a printing is sold in, in words.
const FINISHES = {
    nonfoil: "Normal",
    foil: "Foil",
    etched: "Foil grabado",
    normal: "Normal",
    holo: "Holo",
    reverse: "Reverso holo",
    firstEdition: "1.ª edición"
};

export const finishesText = (printing) => (printing.finishes || []).map((finish) => t(FINISHES[finish] || finish)).join(", ");

// ---- What is printed on the card ----------------------------------------------

// Magic's mana cost as small coloured symbols ({2}{G} → ②🟢), with the cost in words for readers.
function manaHtml(cost) {
    if (!cost) return "";
    const marks = (cost.match(/\{[^}]+\}/g) || [])
        .map((symbol) => {
            const value = symbol.slice(1, -1);
            // A colour of mana, a number (or X) of any colour, or a hybrid.
            const color = MAGIC_COLORS[value] ? value : /^\d+$/.test(value) || value === "X" ? "N" : "H";
            return `<span class="mana" data-c="${color}" aria-hidden="true">${h(value)}</span>`;
        })
        .join("");
    return `<span class="mana-cost" role="img" aria-label="${h(t("Coste de maná {cost}", { cost }))}">${marks}</span>`;
}

// One line under the card's facts: its type, then its numbers.
export function gameStatsHtml(card) {
    const details = card.details || {};
    if (card.game === "magic") {
        const types = (card.subtypes || []).filter((word) => MAGIC_TYPES[word]);
        return [
            h(details.type_line || types.join(" ")),
            manaHtml(details.mana_cost),
            details.power != null ? h(`${details.power}/${details.toughness}`) : "",
            details.loyalty != null ? h(t("Lealtad {number}", { number: details.loyalty })) : "",
            details.defense != null ? h(t("Defensa {number}", { number: details.defense })) : ""
        ]
            .filter(Boolean)
            .join(" · ");
    }
    const weakness = (details.weaknesses || []).map(pokemonWord).join(", ");
    const resistance = (details.resistances || []).map(pokemonWord).join(", ");
    return [
        h(typeLine(card)),
        details.evolves_from ? h(t("Evoluciona de {name}", { name: details.evolves_from })) : "",
        weakness ? h(t("Debilidad: {types}", { types: weakness })) : "",
        resistance ? h(t("Resistencia: {types}", { types: resistance })) : "",
        details.retreat != null ? h(t("Retirada {number}", { number: details.retreat })) : "",
        details.illustrator ? h(t("Ilustración: {name}", { name: details.illustrator })) : ""
    ]
        .filter(Boolean)
        .join(" · ");
}

// ---- Where the card may be played ---------------------------------------------

// Magic's formats, in the order players know them.
const FORMATS = {
    standard: "Standard",
    pioneer: "Pioneer",
    modern: "Modern",
    legacy: "Legacy",
    vintage: "Vintage",
    commander: "Commander",
    pauper: "Pauper",
    paupercommander: "Pauper Commander",
    oathbreaker: "Oathbreaker",
    premodern: "Premodern"
};
const LEGALITY = { legal: "Legal", not_legal: "No legal", banned: "Prohibida", restricted: "Restringida" };
// Tone and mark of each state, with the banlist's badges (styles.css .bn-*).
const LEGALITY_BADGE = {
    legal: ["ok", "✓"],
    not_legal: ["unknown", "–"],
    banned: ["forbidden", "✕"],
    restricted: ["limited", "1"]
};
const MAGIC_LIST = "https://magic.wizards.com/en/banned-restricted-list";

// Each format with its state: [name, state]. Pokémon has two, Standard and Expanded.
function legalities(card) {
    if (card.game === "magic") {
        const formats = card.details?.legalities || {};
        return Object.entries(FORMATS)
            .filter(([key]) => formats[key])
            .map(([key, name]) => [name, formats[key]]);
    }
    const legal = card.details?.legal || {};
    return [
        ["Standard", legal.standard],
        ["Expanded", legal.expanded]
    ]
        .filter(([, value]) => value != null)
        .map(([name, value]) => [name, value ? "legal" : "not_legal"]);
}

// Among the card's facts: the formats where it is legal, banned or restricted.
export function legalityHtml(card) {
    const items = legalities(card)
        .filter(([, state]) => state !== "not_legal")
        .map(([name, state]) => {
            const label = state === "legal" ? "" : ` · ${h(t(LEGALITY[state]))}`;
            return `<span class="fmt" data-legal="${h(state)}">${h(name)}${label}</span>`;
        })
        .join("");
    return items ? `<span class="fmts">${items}</span>` : h(t("No legal en torneos"));
}

function legalityRow([name, state]) {
    const [tone, mark] = LEGALITY_BADGE[state] || LEGALITY_BADGE.not_legal;
    return html`
        <div class="bl-row">
            <span class="bn bn-${tone}" aria-hidden="true">${mark}</span>
            <div><b>${h(name)} · ${h(t(LEGALITY[state] || state))}</b></div>
        </div>`;
}

const note = (text) => `<p class="catalog-status">${text}</p>`;

// The section in place of the banlist, as [title, content].
export function legalitySection(card) {
    const rows = legalities(card).map(legalityRow).join("");
    if (card.game === "magic") {
        const link = `<a href="${MAGIC_LIST}" target="_blank" rel="noopener noreferrer">${t("Lista oficial")}</a>`;
        return [
            "Prohibidas y restringidas",
            html`
                ${rows || note(t("Todavía no hay datos de formatos para esta carta."))}
                ${note(`${t("Según la lista de prohibidas y restringidas de Wizards of the Coast. Una carta restringida admite una sola copia en el mazo.")} ${link}`)}`
        ];
    }
    const mark = card.details?.regulation_mark;
    return [
        "Legalidad en torneos",
        html`
            ${rows || note(t("Todavía no hay datos de legalidad para esta carta."))}
            ${mark ? note(h(t("Marca de regulación {mark}: Standard admite solo las marcas vigentes de la temporada.", { mark }))) : ""}
            ${note(t("Pokémon no tiene una banlist como la de Yu-Gi-Oh!: Standard cambia con cada rotación y Expanded tiene su propia lista de cartas prohibidas."))}`
    ];
}
