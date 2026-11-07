// The secret skins: another look for the whole site, Skeuomorfismo or Frutiger
// Metro, each with its light and dark mode (frontend/theme.js). They are chosen
// in a hidden window (frontend/js/skin-picker.js) and kept in this browser.
//
// A classic script in <head>, before theme.js, so the page never shows a moment
// of the usual look first: it writes the chosen skin's stylesheet into the page
// while the page is still being read, and the browser waits for it before
// painting. The stylesheets, with their versioned addresses, are listed in the
// page's <template class="skins"> (frontend/pages/skins.html); a template's
// links are not downloaded, so without a choice nothing extra is.
(function () {
    var KEY = "cm_skin";
    var choice = null;
    try {
        // Saved as JSON, like the site's other preferences (js/storage.js).
        choice = JSON.parse(localStorage.getItem(KEY));
    } catch (error) {
        return; // Storage blocked or unreadable: the usual look.
    }
    if (typeof choice !== "string" || !/^[a-z-]+$/.test(choice)) return;
    var list = document.querySelector("template.skins");
    var sheet = list && list.content.querySelector('link[data-skin="' + choice + '"]');
    if (!sheet) return; // A skin that no longer exists.
    document.documentElement.dataset.skin = choice;
    document.write(sheet.outerHTML);
})();
