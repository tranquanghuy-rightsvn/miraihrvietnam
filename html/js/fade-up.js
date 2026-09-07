"use strict";
(function () {
  var els = document.querySelectorAll(".js-fade-up");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 },
  );

  els.forEach(function (el) {
    observer.observe(el);
  });
})();
