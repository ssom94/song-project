(() => {
  function addApExamMenuLink() {
    const lang = document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
    const sidebar = document.getElementById('blog-dashboard-sidebar');
    if (!sidebar) return;
    const submenu = sidebar.querySelector('[data-menu-group="ap"] .blog-sidebar-submenu');
    if (!submenu || submenu.querySelector('[data-ap-exams-menu-link]')) return;
    const conceptLink = Array.from(submenu.querySelectorAll('a')).find((link) => link.getAttribute('href') === `/${lang}/study/ap/concepts/`);
    const link = document.createElement('a');
    link.className = `blog-sidebar-link blog-sidebar-sub-link${location.pathname.includes('/study/ap/mock-exams/') || location.pathname.includes('/study/ap/past-exams/') || location.pathname.includes('/study/ap/reinforcement/') ? ' is-active' : ''}`;
    link.href = `/${lang}/study/ap/mock-exams/`;
    link.textContent = lang === 'ko' ? '모의고사·실제 기출' : '模擬試験・実際の過去問';
    link.dataset.apExamsMenuLink = 'true';
    if (link.classList.contains('is-active')) link.setAttribute('aria-current', 'page');
    if (conceptLink?.nextSibling) submenu.insertBefore(link, conceptLink.nextSibling);
    else if (conceptLink) submenu.appendChild(link);
    else submenu.appendChild(link);
  }

  function install() {
    addApExamMenuLink();
    const sidebar = document.getElementById('blog-dashboard-sidebar');
    if (!sidebar) return;
    const observer = new MutationObserver(addApExamMenuLink);
    observer.observe(sidebar, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
