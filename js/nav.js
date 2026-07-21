(function() {
  function renderNav() {
    var token = localStorage.getItem('ews_token');
    var role = localStorage.getItem('ews_role') || '';
    var platformAccess = localStorage.getItem('ews_platform_access') || 'allow';
    var isLoggedIn = !!token;
    var isAdmin = role === 'admin';
    var cur = window.location.pathname;

    function canUse(platform) {
      return isAdmin || platformAccess === 'allow' || platformAccess === platform;
    }

    var links = '';
    var allPages = [{ p: '/', l: '任务列表' }];
    if (canUse('jst')) allPages.push({ p: '/create-jst.html', l: '聚水潭任务' });
    if (canUse('shopee')) allPages.push({ p: '/create-shopee.html', l: 'Shopee 任务' });
    allPages.push({ p: '/guide.html', l: '使用说明' });
    if (isAdmin) allPages.push({ p: '/shopee-templates.html', l: '模板管理' });
    if (isAdmin) allPages.push({ p: '/config.html', l: '系统配置' });
    if (isLoggedIn) allPages.push({ p: '/password.html', l: '账号安全' });

    for (var i = 0; i < allPages.length; i++) {
      var isActive = cur === allPages[i].p || cur.replace('.html','') === allPages[i].p.replace('.html','');
      links += '<a href="' + allPages[i].p + '" class="nav-link' + (isActive ? ' active' : '') + '"' + (isActive ? ' aria-current="page"' : '') + '>' + allPages[i].l + '</a>';
    }

    var rightHtml = '';
    if (isLoggedIn) {
      rightHtml += '<div class="nav-account">';
      rightHtml += '<span class="nav-credits"><span>算力</span><b id="navCredits">...</b></span>';
      rightHtml += '<button type="button" id="navRefreshCredits" class="nav-refresh">刷新</button>';
      rightHtml += '<button type="button" id="navLogout" class="nav-logout">退出</button>';
      rightHtml += '</div>';
    }

    var existing = document.getElementById('ewsNav');
    if (existing) existing.remove();
    var nav = document.createElement('nav');
    nav.id = 'ewsNav';
    nav.className = 'navbar';
    nav.innerHTML = '<div class="navbar-inner">'
      + '<a href="/" class="navbar-brand"><span class="brand-mark">E</span><span class="brand-copy"><strong>EWS</strong><small>商品生产工作台</small></span></a>'
      + '<div class="navbar-nav">' + links + '</div>'
      + '<div class="navbar-right">' + rightHtml + '</div>'
      + '</div>';
    document.body.insertBefore(nav, document.body.firstChild);
    var activeLink = nav.querySelector('.nav-link.active');
    if (activeLink && window.innerWidth <= 900) requestAnimationFrame(function() { activeLink.scrollIntoView({ block: 'nearest', inline: 'center' }); });

    var refresh = document.getElementById('navRefreshCredits');
    if (refresh) {
      refresh.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof window.refreshNavCredits === 'function') window.refreshNavCredits();
      });
    }
    var logout = document.getElementById('navLogout');
    if (logout) {
      logout.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof window.handleLogout === 'function') window.handleLogout();
      });
    }
  }
  window.renderEwsNav = renderNav;
  renderNav();
})();
