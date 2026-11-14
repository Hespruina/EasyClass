/* 前端设计风格体系 — 文档页交互
 * 依赖：DOM 就绪（脚本置于 </body> 前）；无框架、无构建、无模块导入。
 * 职责：目录高亮 / 阅读进度 / 代码复制 / 点名框 / Ribbon / 模态 / Toast / 座位 / 动效重播。
 */
(function(){
  'use strict';
  var $ = function(s,r){return (r||document).querySelector(s);};
  var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};

  /* ---- 阅读进度 + 目录高亮 ---- */
  var progress = $('#dProgress');
  var links = $$('.d-nav a');
  var sections = links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1));});
  function onScroll(){
    var h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    var idx = 0;
    sections.forEach(function(sec,i){
      if(sec && sec.getBoundingClientRect().top <= 140) idx = i;
    });
    links.forEach(function(a,i){a.classList.toggle('active', i === idx);});
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---- 复制代码 ---- */
  $$('.d-copy').forEach(function(btn){
    btn.addEventListener('click', function(){
      var box = btn.closest('.d-code');
      var pre = box && box.querySelector('pre');
      if(!pre) return;
      var text = pre.innerText;
      var done = function(){btn.textContent='已复制';setTimeout(function(){btn.textContent='复制';},1400);};
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done, function(){fallback(text,done);});
      }else{ fallback(text,done); }
    });
  });
  function fallback(text, done){
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.left='-9999px';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(e){}
    document.body.removeChild(ta); done();
  }

  /* ---- 点名框：真实三态交互 ---- */
  var NAMES = ['就很随机','张伟','李思远','王雨桐','陈子墨','赵一诺','周予安','吴一诺'];
  var dmk = $('#demoDmk'), nameEl = $('#demoName'), startBtn = $('#demoStart'), stopBtn = $('#demoStop');
  var tick = null;
  function setDraw(on){
    if(on){
      dmk.classList.remove('yincangdonghua','mansuxianshi');
      dmk.classList.add('kuaisuxianshi');
      nameEl.classList.add('huxi');
      startBtn.classList.remove('chuxian'); startBtn.classList.add('yincang');
      stopBtn.classList.remove('yincang'); stopBtn.classList.add('chuxian');
      tick = setInterval(function(){nameEl.textContent = NAMES[Math.floor(Math.random()*NAMES.length)];}, 90);
    }else{
      if(tick){clearInterval(tick);tick=null;}
      dmk.classList.remove('kuaisuxianshi','mansuxianshi');
      dmk.classList.add('yincangdonghua');
      nameEl.classList.remove('huxi');
      stopBtn.classList.remove('chuxian'); stopBtn.classList.add('yincang');
      startBtn.classList.remove('yincang'); startBtn.classList.add('chuxian');
    }
  }
  startBtn.addEventListener('click', function(){setDraw(true);});
  stopBtn.addEventListener('click', function(){setDraw(false);});

  /* ---- 性别三态 ---- */
  $$('#demoGender .gender-filter-btn').forEach(function(b){
    b.addEventListener('click', function(){
      $$('#demoGender .gender-filter-btn').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
    });
  });
  $$('.filter-panel .gender-filter-btn').forEach(function(b){
    b.addEventListener('click', function(){
      $$('.filter-panel .gender-filter-btn').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
    });
  });

  /* ---- 控制台小导航 ---- */
  $$('[data-mini-nav]').forEach(function(n){
    n.addEventListener('click', function(){
      $$('[data-mini-nav]').forEach(function(x){x.classList.remove('active');});
      n.classList.add('active');
    });
  });

  /* ---- 模态 ---- */
  var modal = $('#demoModal');
  function openModal(){modal.classList.remove('hiding');modal.classList.add('show');}
  function closeModal(){
    modal.classList.remove('show'); modal.classList.add('hiding');
    setTimeout(function(){modal.classList.remove('hiding');},210);
  }
  $('#modalOpen').addEventListener('click', openModal);
  ['#modalClose','#modalCancel','#modalOk'].forEach(function(s){$(s).addEventListener('click', closeModal);});

  /* ---- Toast ---- */
  var toast = $('#demoToast'), toastText = $('#demoToastText'), toastTimer = null;
  $$('[data-toast]').forEach(function(b){
    b.addEventListener('click', function(){
      var kind = b.getAttribute('data-toast');
      if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}
      toast.classList.remove('show','error','busy');
      if(kind === 'ok'){toastText.textContent='已保存到云端';}
      else if(kind === 'error'){toastText.textContent='保存失败，请重试';toast.classList.add('error');}
      else{toastText.textContent='正在保存到云端…';toast.classList.add('busy');}
      void toast.offsetWidth;
      toast.classList.add('show');
      if(kind !== 'busy'){toastTimer = setTimeout(function(){toast.classList.remove('show');},2400);}
    });
  });

  /* ---- Ribbon 选项卡 ---- */
  $$('[data-rb-tab]').forEach(function(tab){
    tab.addEventListener('click', function(){
      var mode = tab.getAttribute('data-rb-tab');
      $('#ribbon').setAttribute('data-mode', mode);
      $$('[data-rb-tab]').forEach(function(t){
        var on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    });
  });

  /* ---- 座位状态 ---- */
  var seats = $$('#seatCanvas .seat');
  var seatA = seats[0], seatB = seats[1];
  seats.forEach(function(s){
    s.addEventListener('click', function(){s.classList.toggle('selected');});
  });
  function clearSeatStates(){
    seats.forEach(function(s){s.classList.remove('empty-seat','picked','drop-target');});
  }
  $('#seatStateReset').addEventListener('click', clearSeatStates);
  $('#seatStateEmpty').addEventListener('click', function(){clearSeatStates();seatA.classList.add('empty-seat');});
  $('#seatStatePicked').addEventListener('click', function(){clearSeatStates();seatA.classList.add('picked');});
  $('#seatStateDrop').addEventListener('click', function(){clearSeatStates();seatA.classList.add('picked');seatB.classList.add('drop-target');});
  $('#seatStateSwap').addEventListener('click', function(){clearSeatStates();seatB.classList.add('swap-target');});
  $('#seatStateDrag').addEventListener('click', function(){clearSeatStates();seatA.classList.add('drag-source');});

  /* ---- 动效重播 ---- */
  $('#fxReplay').addEventListener('click', function(){
    $$('#fxStage .d-fx-box').forEach(function(box,i){
      var cls = ['fx-rise','fx-pop','fx-slide','fx-fade'][i];
      box.classList.remove(cls); void box.offsetWidth; box.classList.add(cls);
    });
  });
  $('#fxStagger').addEventListener('click', function(){
    var host = $('.d-stagger'); var kids = $$('.d-stagger > div');
    kids.forEach(function(k){k.style.animation='none';});
    void host.offsetWidth;
    kids.forEach(function(k){k.style.animation='';});
  });
})();

/* ---- 主题切换（09.14：成对令牌 + html[data-theme]，持久化 localStorage） ---- */
(function(){
  var KEY='design-theme';
  var root=document.documentElement;
  var $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s));};
  function apply(t){
    if(t==='light'){root.setAttribute('data-theme','light');}else{root.removeAttribute('data-theme');}
    $$('.theme-toggle').forEach(function(b){b.textContent=(t==='light')?'切换深色主题':'切换浅色主题';});
  }
  var saved=null;
  try{saved=localStorage.getItem(KEY);}catch(e){}
  apply(saved==='light'?'light':'dark');
  $$('.theme-toggle').forEach(function(b){
    b.addEventListener('click',function(){
      var next=(root.getAttribute('data-theme')==='light')?'dark':'light';
      try{localStorage.setItem(KEY,next);}catch(e){}
      apply(next);
    });
  });
})();
