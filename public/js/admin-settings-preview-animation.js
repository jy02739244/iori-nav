(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  const shared = ns.previewShared;

 const CARD_ANIMATION_TYPES = ['slideUp', 'radial', 'fadeIn', 'slideLeft', 'slideRight', 'convergeIn', 'flipIn'];

 const CARD_ANIMATION_CLASSES = CARD_ANIMATION_TYPES.map(type => `preview-card-anim-${type}`);

 const REDUCED_MOTION_QUERY = window.matchMedia?.('(prefers-reduced-motion: reduce)');

 function prefersReducedMotion() {
    return REDUCED_MOTION_QUERY?.matches === true;
  }

 function getLegacyPreviewCard() {
    const preview1 = document.getElementById('cardStyle1PreviewContainer');
    const preview2 = document.getElementById('cardStyle2PreviewContainer');
    const preview3 = document.getElementById('cardStyle3PreviewContainer');
    const container = [preview1, preview2, preview3].find(preview => preview && !preview.classList.contains('hidden'));
    return container?.querySelector('.site-card') || null;
  }

 function getVisiblePreviewCards() {
    const liveCards = Array.from(document.querySelectorAll('#homeLivePreview .live-card'));
    if (liveCards.length > 0) return liveCards;

    const legacyCard = getLegacyPreviewCard();
    return legacyCard ? [legacyCard] : [];
  }

 function resolvePreviewAnimation() {
    const refs = shared.getRefs();
    const isMobilePreview = document.getElementById('homeLivePreview')?.dataset.device === 'mobile';
    const selected = isMobilePreview
      ? refs.mobileCardAnimationSelect?.value || shared.getCurrentSettings().mobile_layout_card_animation || 'radial'
      : refs.cardAnimationSelect?.value || shared.getCurrentSettings().layout_card_animation || 'radial';
    if (selected === 'random') {
      return CARD_ANIMATION_TYPES[Math.floor(Math.random() * CARD_ANIMATION_TYPES.length)];
    }
    return CARD_ANIMATION_TYPES.includes(selected) ? selected : 'radial';
  }

 function triggerPreviewAnimation() {
    const cards = getVisiblePreviewCards();
    if (cards.length === 0) return;

    const animation = resolvePreviewAnimation();
    const midpoint = (cards.length - 1) / 2;

    cards.forEach((card, index) => {
      cleanupPreviewAnimation(card);

      if (animation === 'convergeIn') {
        const fromLeft = index <= midpoint;
        card.style.setProperty('--preview-card-anim-x', fromLeft ? '-80px' : '80px');
        card.style.setProperty('--preview-card-anim-y', '0');
      }

      void card.offsetWidth;
      card.style.animationDelay = `${Math.min(index * 0.045, 0.18)}s`;
      card.classList.add('preview-card-anim-enter', `preview-card-anim-${animation}`);

      if (prefersReducedMotion()) {
        cleanupPreviewAnimation(card);
        return;
      }

      let isCleaned = false;
      let isCleanupScheduled = false;
      let fallbackTimer = null;

      const cleanup = () => {
        if (isCleaned) return;
        isCleaned = true;
        cleanupPreviewAnimation(card);
        card.removeEventListener('animationend', handleAnimationEnd);
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
      };

      const finish = () => {
        if (isCleaned || isCleanupScheduled) return;
        isCleanupScheduled = true;
        const cleanupDelay = card.classList.contains('preview-card-anim-flipIn') ? 140 : 0;
        if (cleanupDelay > 0) {
          window.setTimeout(cleanup, cleanupDelay);
        } else {
          cleanup();
        }
      };

      const handleAnimationEnd = (event) => {
        if (event.target !== card) return;
        finish();
      };

      fallbackTimer = window.setTimeout(cleanup, 1100);
      card.addEventListener('animationend', handleAnimationEnd);
    });
  }

 function cleanupPreviewAnimation(card) {
    card.classList.add('preview-card-anim-cleanup');
    CARD_ANIMATION_CLASSES.forEach(className => card.classList.remove(className));
    card.classList.remove('preview-card-anim-enter');
    card.style.removeProperty('--preview-card-anim-x');
    card.style.removeProperty('--preview-card-anim-y');
    card.style.removeProperty('animation-delay');
    window.requestAnimationFrame(() => {
      card.classList.remove('preview-card-anim-cleanup');
    });
  }

 function syncAnimationOptions(device = 'all') {
    const refs = shared.getRefs();
    const devices = device === 'all' ? ['desktop', 'mobile'] : [device];
    devices.forEach(targetDevice => {
      const select = targetDevice === 'mobile' ? refs.mobileCardAnimationSelect : refs.cardAnimationSelect;
      const selected = select?.value || 'radial';
      document.querySelectorAll(`.card-animation-option[data-animation-device="${targetDevice}"]`).forEach(option => {
        const isActive = option.dataset.animation === selected;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    });
  }

  ns.previewAnimation = {
    triggerPreviewAnimation,
    syncAnimationOptions,
  };
})();
