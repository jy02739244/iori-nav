(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const Home = window.IoriHome = window.IoriHome || {};

    Home.initCommonUi?.();

    if (typeof Home.createCardController === 'function') {
      Home.cardController = Home.createCardController();
      Home.cardController.init();
    }

    Home.initSubmission?.();
    Home.initSearch?.();
    Home.initCategoryNavigation?.();

    requestAnimationFrame(() => {
      document.body.classList.add('app-ready');
    });
  });
})();
