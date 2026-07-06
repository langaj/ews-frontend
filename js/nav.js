// EWS - 导航栏组件
(function() {
  var token = localStorage.getItem('ews_token');
  var role = localStorage.getItem('ews_role') || '';
  var isLoggedIn = !!token;
  var isAdmin = role === 'admin';
  var cur = window.location.pathname;

  var links = '';
  var allPages = [
    { p: '/', l: '任务列表' },
    { p: '/create-jst.html', l: '创建(聚水潭)' },
    { p: '/create-shopee.html', l: '创建(虾皮)' },
  ];
  if (isAdmin) {
    allPages.push({ p: '/config.html', l: '系统配置' });
    allPages.push({ p: '/doc.html', l: 'API文档' });
  }
  for (var i = 0; i < allPages.length; i++) {
    var isActive = cur === allPages[i].p || cur.replace('.html','') === allPages[i].p.replace('.html','');
    links += '<a href="' + allPages[i].p + '" class="nav-link' + (isActive ? ' active' : '') + '">' + allPages[i].l + '</a>';
  }

  var rightHtml = '';
  if (isLoggedIn) {
    rightHtml += '<span class="nav-credits">算力: <b id="navCredits">\u2026</b>';
    rightHtml += '<a href="javascript:void(0)" id="navRefreshCredits" class="nav-refresh">刷新</a></span>';
  }

  var nav = document.createElement('nav');
  nav.className = 'navbar';
  nav.innerHTML = '<div class="navbar-inner">'
    + '<a href="/" class="navbar-brand">EWS</a>'
    + '<div class="navbar-nav">' + links + '</div>'
    + '<div class="navbar-right">' + rightHtml + '</div>'
    + '</div>';
  document.body.insertBefore(nav, document.body.firstChild);
})();
