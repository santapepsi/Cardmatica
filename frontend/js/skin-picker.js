// The secret window of skins: the usual look (Aero), Skeuomorfismo or Frutiger
// Metro. frontend/skin.js puts the chosen one on every page before it paints;
// this window changes it at once, without reloading.
//
// It opens with the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) anywhere but in a text
// field, or by typing "/skins" in the search box, which works on phones too.
// The skins and their stylesheets are listed in the page's <template class="skins">.
import { escapeHtml, html } from "./html.js";
import { t } from "./lang.js";
import { writeJson } from "./storage.js";

const h = escapeHtml;
const KEY = "cm_skin";
const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
const COMMAND = "/skins";
const root = document.documentElement;

// What each skin looks like, in a line. The usual look has no stylesheet of its own.
const ABOUT = {
    "": "El aero de siempre: vidrio, celeste y degradados suaves.",
    skeuomorphism: "Tapete de fieltro, cuero cosido, madera y botones de bronce.",
    metro: "Mosaicos planos de colores, esquinas rectas y letras finas."
};

const sheets = () => [...(document.querySelector("template.skins")?.content.querySelectorAll("link[data-skin]") || [])];
const skins = () => [["", "Aero"], ...sheets().map((sheet) => [sheet.dataset.skin, sheet.dataset.label])];
const current = () => root.dataset.skin || "";

// The browser bar on phones takes the colour of the skin (--bar in styles.css).
function paintBar() {
    const bar = document.querySelector('meta[name="theme-color"]');
    const color = getComputedStyle(root).getPropertyValue("--bar").trim();
    if (bar && color) bar.content = color;
}

function show(name) {
    if (name) root.dataset.skin = name;
    else delete root.dataset.skin;
    paintBar();
    document.querySelectorAll("[data-skin-pick]").forEach((option) => {
        option.setAttribute("aria-pressed", String(option.dataset.skinPick === (name || "")));
    });
}

// The skin's stylesheet is added once and the look changes when it has
// arrived, so the page never shows half of it.
function choose(name) {
    writeJson(KEY, name || null);
    if (!name || document.head.querySelector(`link[data-skin="${name}"]`)) return show(name);
    const sheet = sheets().find((item) => item.dataset.skin === name);
    if (!sheet) return;
    const link = sheet.cloneNode();
    link.addEventListener("load", () => show(name), { once: true });
    document.head.append(link);
}

function pickerHtml() {
    const options = skins()
        .map(
            ([name, label]) => html`
                <button type="button" aria-pressed="${name === current()}" data-skin-pick="${h(name)}">
                    <span class="skin-swatch" data-swatch="${h(name || "aero")}" aria-hidden="true"></span>
                    <span><b>${h(t(label))}</b><small>${h(t(ABOUT[name] || ""))}</small></span>
                </button>`
        )
        .join("");
    return html`
        <form method="dialog">
            <h2 id="skin-title">${t("Apariencias secretas")}</h2>
            <p>${t("Cambian el aspecto de todo el sitio y se guardan en este navegador. El modo claro u oscuro sigue funcionando con cada una.")}</p>
            <div class="skin-options" role="group" aria-labelledby="skin-title">${options}</div>
            <p class="skin-actions"><button class="btn">${t("Listo")}</button></p>
        </form>`;
}

function open() {
    let dialog = document.getElementById("skin-picker");
    if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "skin-picker";
        dialog.className = "skin-picker gl";
        dialog.setAttribute("aria-labelledby", "skin-title");
        dialog.addEventListener("click", (event) => {
            const option = event.target.closest("[data-skin-pick]");
            if (option) choose(option.dataset.skinPick);
            // A click on the backdrop, outside the window, closes it.
            else if (event.target === dialog) dialog.close();
        });
        document.body.append(dialog);
    }
    dialog.innerHTML = pickerHtml();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[aria-pressed="true"]')?.focus();
}

export function installSkinPicker({ search }) {
    if (!sheets().length) return;
    let typed = 0;
    document.addEventListener("keydown", (event) => {
        if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
        const key = event.key.toLowerCase();
        typed = key === KONAMI[typed] ? typed + 1 : key === KONAMI[0] ? 1 : 0;
        if (typed === KONAMI.length) {
            typed = 0;
            open();
        }
    });
    // Before the search sees it: "/skins" opens the window and is not searched,
    // and neither is the start of it ("/sk") while it is being typed.
    document.addEventListener(
        "input",
        (event) => {
            if (event.target !== search) return;
            const value = search.value.trim().toLowerCase();
            if (!value.startsWith("/") || !COMMAND.startsWith(value)) return;
            event.stopImmediatePropagation();
            if (value !== COMMAND) return;
            search.value = "";
            search.blur();
            open();
        },
        true
    );
}
