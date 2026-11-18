/* Script du site Mister Climat.
   1. Formulaire en petites étapes (« quiz ») : un choix = on passe à l'étape suivante.
   2. Envoi du formulaire sans quitter la page, puis merci.html.
   3. Comptage des clics sur le numéro (prêt pour Google Ads : rien n'est envoyé
      tant que la balise Google Ads et le bandeau cookies ne sont pas ajoutés).
   Aucune bibliothèque externe. Sans JavaScript, toutes les questions s'affichent
   d'un coup et le formulaire s'envoie quand même (envoi classique). */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var annee = document.querySelector("[data-annee]");
  if (annee) annee.textContent = new Date().getFullYear();

  /* ---------- Suivi des conversions ----------
     mcSuivi("appel", "entete") : appelé à chaque appui sur un numéro.
     Le jour du lancement de la pub : ajouter la balise Google Ads du compte DU PÈRE
     (jamais celle de Thermaz) et le bandeau de consentement, puis compléter ici
     l'identifiant de conversion (send_to). */
  var CONVERSIONS = {
    appel: "",      // ex. "AW-XXXXXXXXX/xxxxxxxx" : clic sur le numéro
    formulaire: ""  // ex. "AW-XXXXXXXXX/yyyyyyyy" : formulaire envoyé
  };
  window.dataLayer = window.dataLayer || [];
  window.mcSuivi = function (type, detail) {
    window.dataLayer.push({ event: "mc_" + type, detail: detail || "", page: location.pathname });
    if (typeof window.gtag === "function" && CONVERSIONS[type]) {
      window.gtag("event", "conversion", { send_to: CONVERSIONS[type] });
    }
  };
  document.addEventListener("click", function (ev) {
    var lien = ev.target.closest && ev.target.closest('a[href^="tel:"]');
    if (lien) window.mcSuivi("appel", lien.getAttribute("data-suivi") || "lien");
  });

  /* ---------- Carte des zones de déplacement (page dépannage) ----------
     Les communes, leur zone et leur distance sont écrites dans la carte elle-même
     (attributs data-c, data-z, data-km), fabriquée par outils\zones-carte.py. */
  var carte = document.querySelector("[data-zcarte]");
  if (carte) {
    var DIAG = parseInt(carte.getAttribute("data-diag"), 10);
    var FRAIS = carte.getAttribute("data-frais").split(",").map(Number);
    var formes = carte.querySelectorAll(".zc");
    var champ = carte.querySelector("#zc-q");
    var res = carte.querySelector(".zc-res");
    var cadre = carte.querySelector(".zc-carte");
    var plat = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, ""); };
    var infos = function (f) {
      var z = parseInt(f.getAttribute("data-z"), 10);
      return { nom: f.getAttribute("data-c"), zone: z, km: parseInt(f.getAttribute("data-km"), 10), frais: FRAIS[z - 1] };
    };
    var montrer = function (f, depuisChamp) {
      var c = infos(f);
      Array.prototype.forEach.call(formes, function (x) { x.classList.toggle("on", x === f); });
      f.parentNode.appendChild(f); // passe au-dessus des voisines pour que le contour jaune se voie
      if (!depuisChamp) champ.value = c.nom;
      res.innerHTML =
        '<p class="zc-nom"></p>' +
        '<p class="zc-detail">Zone ' + c.zone + (c.km ? " · environ " + c.km + " km d'Eyguières par la route" : " · sur place") + "</p>" +
        '<dl class="zc-lignes">' +
        "<div><dt>Diagnostic sur place</dt><dd>" + DIAG + " €</dd></div>" +
        "<div><dt>Déplacement</dt><dd>" + (c.frais ? "+ " + c.frais + " €" : "compris") + "</dd></div>" +
        '<div class="total"><dt>Total avant réparation</dt><dd>' + (DIAG + c.frais) + " €</dd></div>" +
        "</dl>" +
        '<p class="petit">Les ' + DIAG + " € du diagnostic sont déduits de la facture si Thierry fait la réparation.</p>" +
        '<a class="bt bt-soleil bt-appel" href="tel:+33749935315" data-suivi="appel-carte"><span class="ico-tel" aria-hidden="true"></span>Appeler le 07 49 93 53 15</a>';
      res.querySelector(".zc-nom").textContent = c.nom;
    };
    cadre.addEventListener("click", function (ev) { var f = ev.target.closest(".zc"); if (f) montrer(f); });
    cadre.addEventListener("keydown", function (ev) {
      var f = ev.target.closest(".zc");
      if (f && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); montrer(f); }
    });
    var chercher = function () {
      var t = plat(champ.value);
      if (!t) return;
      for (var k = 0; k < formes.length; k++) {
        if (plat(formes[k].getAttribute("data-c")) === t) { montrer(formes[k], true); return; }
      }
    };
    champ.addEventListener("input", chercher);
    champ.addEventListener("change", chercher);

    // Bulle au survol (souris seulement : au doigt, c'est le toucher qui affiche le prix)
    var bulle = document.createElement("div");
    bulle.className = "zc-bulle";
    bulle.hidden = true;
    cadre.appendChild(bulle);
    cadre.addEventListener("pointermove", function (ev) {
      var f = ev.pointerType === "mouse" && ev.target.closest(".zc");
      if (!f) { bulle.hidden = true; return; }
      var c = infos(f);
      bulle.innerHTML = "<b></b>Diagnostic " + (DIAG + c.frais) + " €, déplacement " + (c.frais ? "+ " + c.frais + " €" : "compris");
      bulle.firstChild.textContent = c.nom;
      bulle.hidden = false;
      var r = cadre.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      bulle.style.left = Math.max(4, Math.min(x + 14, r.width - bulle.offsetWidth - 4)) + "px";
      bulle.style.top = (y - bulle.offsetHeight - 12 < 0 ? y + 18 : y - bulle.offsetHeight - 12) + "px";
    });
    cadre.addEventListener("pointerleave", function () { bulle.hidden = true; });
  }

  /* ---------- Formulaire en étapes ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("form[data-quiz]"), function (form) {
    var etapes = form.querySelectorAll(".etape");
    var barre = form.querySelector(".quiz-barre span");
    var num = form.querySelector(".quiz-num b");
    var total = form.querySelector(".quiz-num i");
    var alerte = form.querySelector(".alerte-panne");
    var i = 0;
    if (total) total.textContent = etapes.length;

    function montrer(n, focus) {
      i = Math.max(0, Math.min(n, etapes.length - 1));
      Array.prototype.forEach.call(etapes, function (e, k) { e.classList.toggle("active", k === i); });
      if (barre) barre.style.width = Math.round(((i + 1) / etapes.length) * 100) + "%";
      if (num) num.textContent = i + 1;
      if (focus) {
        var cible = etapes[i].querySelector("input:not([type=radio]), legend");
        if (cible && cible.tagName === "INPUT") cible.focus({ preventScroll: true });
        var haut = form.getBoundingClientRect().top;
        if (haut < 0) form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    // Un choix dans une liste de boutons = étape suivante
    form.addEventListener("change", function (ev) {
      var t = ev.target;
      if (t.type !== "radio") return;
      if (t.name === "prestation" && alerte) alerte.classList.toggle("visible", /panne/i.test(t.value));
      if (t.name === "prestation" && /panne/i.test(t.value)) return; // on laisse lire le conseil « appelez »
      setTimeout(function () { montrer(i + 1, true); }, 180);
    });

    form.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-retour]")) { ev.preventDefault(); montrer(i - 1, true); }
      if (ev.target.closest("[data-suivant]")) {
        ev.preventDefault();
        var champs = etapes[i].querySelectorAll("input, select, textarea");
        for (var k = 0; k < champs.length; k++) { if (!champs[k].checkValidity()) { champs[k].reportValidity(); return; } }
        montrer(i + 1, true);
      }
    });

    montrer(0, false);
  });

  /* ---------- Envoi ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("form[data-demande]"), function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var etat = form.querySelector(".etat");
      var url = form.getAttribute("action") || "";

      function dire(texte, classe) {
        if (!etat) return;
        etat.className = "etat" + (classe ? " " + classe : "");
        etat.textContent = texte;
      }

      // Champ piège : un humain ne le voit pas, un robot le remplit.
      var piege = form.querySelector("[name='site_web']");
      if (piege && piege.value) return;

      // Vérifie tous les champs, y compris ceux des étapes cachées.
      var champs = form.querySelectorAll("input, select, textarea");
      for (var k = 0; k < champs.length; k++) {
        if (!champs[k].checkValidity()) {
          var etape = champs[k].closest(".etape");
          if (etape && !etape.classList.contains("active")) {
            Array.prototype.forEach.call(form.querySelectorAll(".etape"), function (e) { e.classList.toggle("active", e === etape); });
          }
          champs[k].reportValidity();
          return;
        }
      }

      // Tant que l'adresse d'envoi n'est pas branchée, on ne fait semblant de rien.
      if (!url || url.indexOf("[") !== -1) {
        dire("Formulaire pas encore branché (prototype). Merci d'appeler directement.", "erreur");
        return;
      }

      var donnees = {};
      new FormData(form).forEach(function (valeur, cle) { if (cle !== "site_web") donnees[cle] = valeur; });
      donnees.page = location.pathname;
      donnees.date = new Date().toISOString();

      dire("Envoi en cours…");
      // Format attendu par le script Google Sheets (Apps Script) : un champ « payload » en JSON.
      fetch(url, { method: "POST", mode: "no-cors", body: new URLSearchParams({ payload: JSON.stringify(donnees) }) })
        .then(function () {
          window.mcSuivi("formulaire", donnees.prestation || "");
          dire("Demande envoyée.", "ok");
          location.href = "merci.html";
        })
        .catch(function () {
          dire("L'envoi n'a pas fonctionné. Merci d'appeler directement.", "erreur");
        });
    });
  });
})();
