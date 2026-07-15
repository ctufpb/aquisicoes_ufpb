(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const THIS_YEAR = new Date().getFullYear();
  const FORM_KEY = 'pregao-facil.form';
  const RECENT_KEY = 'pregao-facil.recent';
  const UFPB_FALLBACK = [
    { c: '153065', n: 'UNIVERSIDADE FEDERAL DA PARAÍBA - CAMPUS I', uf: 'PB', a: 1, u: 1 },
    { c: '153066', n: 'PREFEITURA UNIVERSITÁRIA DA UFPB', uf: 'PB', a: 1, u: 1 },
    { c: '153068', n: 'CENTRO DE CIÊNCIAS EXATAS E DA NATUREZA', uf: 'PB', a: 1, u: 1 },
    { c: '153070', n: 'BIBLIOTECA CENTRAL DA UFPB', uf: 'PB', a: 1, u: 1 },
    { c: '153071', n: 'HOSPITAL UNIVERSITÁRIO LAURO WANDERLEY', uf: 'PB', a: 1, u: 1 },
    { c: '153072', n: 'LABORATÓRIO DE TECNOLOGIA FARMACÊUTICA', uf: 'PB', a: 1, u: 1 },
    { c: '153073', n: 'CENTRO DE CIÊNCIAS AGRÁRIAS DA UFPB', uf: 'PB', a: 1, u: 1 },
    { c: '153074', n: 'CENTRO DE CIÊNCIAS HUMANAS, SOCIAIS E AGRÁRIAS', uf: 'PB', a: 1, u: 1 },
    { c: '153076', n: 'CENTRO DE FORMAÇÃO DE PROFESSORES DA UFPB', uf: 'PB', a: 1, u: 1 },
    { c: '155916', n: 'UFPB - CAMPUS IV LITORAL NORTE', uf: 'PB', a: 1, u: 1 }
  ];

  let mode = 'current';
  let uasgs = UFPB_FALLBACK;
  let dataReady = false;
  let recent = readStored(RECENT_KEY, []);
  let installPrompt = null;
  let installed = window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
  let toastTimer = 0;

  const fields = {
    uasgInput: $('uasgInput'),
    tender: $('tenderInput'),
    year: $('yearInput'),
    item: $('itemInput'),
    sipacRequest: $('sipacRequestInput'),
    sipacYear: $('sipacYearInput'),
    sipacCommitment: $('sipacCommitmentInput'),
    management: $('managementInput'),
    commitment: $('commitmentInput')
  };

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function tenderCurrent(value) {
    const raw = onlyDigits(value);
    if (!raw) return '';
    const normalized = raw.length <= 4 ? 90000 + Number(raw) : Number(raw);
    return String(Math.min(99999, normalized)).padStart(5, '0');
  }

  function readStored(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function formValues() {
    return {
      mode,
      uasgInput: fields.uasgInput.value,
      tender: fields.tender.value,
      year: fields.year.value,
      item: fields.item.value,
      sipacRequest: fields.sipacRequest.value,
      sipacYear: fields.sipacYear.value,
      sipacCommitment: fields.sipacCommitment.value,
      management: fields.management.value,
      commitment: fields.commitment.value
    };
  }

  function saveForm() {
    localStorage.setItem(FORM_KEY, JSON.stringify(formValues()));
  }

  function purchaseInfo() {
    const uasg = onlyDigits(fields.uasgInput.value).slice(0, 6);
    const tender = tenderCurrent(fields.tender.value);
    const year = /^\d{4}$/.test(fields.year.value) ? fields.year.value : '';
    const item = Math.max(1, Number(onlyDigits(fields.item.value)) || 1);
    const key = uasg.length === 6 && tender && year ? `${uasg}05${tender}${year}` : '';
    return {
      uasg, tender, year, item, key,
      purchaseUrl: key ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${key}` : '',
      itemUrl: key ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra/item/${item}?compra=${key}` : ''
    };
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3600);
  }

  function remember(label, url) {
    recent = [{ label, url, at: Date.now() }, ...recent.filter(entry => entry.url !== url)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    renderRecent();
  }

  function openUrl(url, label) {
    if (!url) {
      showToast('Confira UASG, pregão, ano e item.');
      return;
    }
    remember(label, url);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function update() {
    const info = purchaseInfo();
    const selected = uasgs.find(record => record.c === info.uasg);
    $('uasgHelp').textContent = selected ? selected.n : dataReady ? 'Selecione uma UASG da lista.' : 'Carregando base oficial de UASGs…';
    $('tenderHelp').textContent = mode === 'current' && info.tender ? `Será usado ${info.tender}` : 'Número sem o ano';
    $('purchaseKey').textContent = info.key || '—';
    $('itemBtn').childNodes[0].nodeValue = `Ver item ${info.item} `;
    $('sipacCommitmentYear').value = fields.sipacYear.value;
    $('transparencyPreview').textContent = `UASG ${info.uasg || '—'} · ${fields.year.value || '—'}NE${onlyDigits(fields.commitment.value).padStart(6, '0')}`;
    document.querySelectorAll('#ufpbList button').forEach(button => button.classList.toggle('selected', button.dataset.code === info.uasg));
    saveForm();
  }

  function setMode(nextMode) {
    mode = nextMode === 'legacy' ? 'legacy' : 'current';
    const current = mode === 'current';
    $('currentModeBtn').classList.toggle('active', current);
    $('legacyModeBtn').classList.toggle('active', !current);
    $('currentModeBtn').setAttribute('aria-pressed', String(current));
    $('legacyModeBtn').setAttribute('aria-pressed', String(!current));
    $('currentActions').hidden = !current;
    $('legacyActions').hidden = current;
    $('itemField').hidden = !current;
    fields.tender.placeholder = current ? '2 ou 90002' : '17';
    update();
  }

  function chooseUasg(record) {
    fields.uasgInput.value = record.c;
    $('uasgSuggestions').hidden = true;
    update();
  }

  function matchingUasgs() {
    const query = normalizeText(fields.uasgInput.value);
    if (!query || /^\d{6}$/.test(query)) return uasgs.filter(record => record.u && record.a).slice(0, 8);
    const numeric = onlyDigits(query);
    const prefix = [];
    const contains = [];
    for (const record of uasgs) {
      const name = normalizeText(record.n);
      if (record.c.startsWith(numeric || query) || name.startsWith(query)) prefix.push(record);
      else if (record.c.includes(numeric || query) || name.includes(query)) contains.push(record);
      if (prefix.length + contains.length >= 40) break;
    }
    return [...prefix, ...contains].slice(0, 8);
  }

  function renderSuggestions() {
    const box = $('uasgSuggestions');
    box.replaceChildren();
    const matches = matchingUasgs();
    for (const record of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'option';
      button.setAttribute('aria-selected', String(record.c === purchaseInfo().uasg));
      const code = document.createElement('span');
      code.className = record.u ? 'uasg-code ufpb' : 'uasg-code';
      code.textContent = record.c;
      const details = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = record.n;
      const meta = document.createElement('small');
      meta.textContent = `${record.uf} · ${record.a ? 'Ativa' : 'Inativa'}`;
      details.append(name, meta);
      button.append(code, details);
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => chooseUasg(record));
      box.append(button);
    }
    box.hidden = matches.length === 0;
    fields.uasgInput.setAttribute('aria-expanded', String(matches.length > 0));
  }

  function renderUfpb() {
    const units = uasgs.filter(record => record.u && record.a);
    const list = units.length ? units : UFPB_FALLBACK;
    $('ufpbCount').textContent = String(list.length);
    $('ufpbList').replaceChildren();
    for (const record of list.slice(0, 6)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.code = record.c;
      const code = document.createElement('span');
      code.textContent = record.c;
      const name = document.createElement('strong');
      name.textContent = record.n;
      button.append(code, name);
      button.addEventListener('click', () => chooseUasg(record));
      $('ufpbList').append(button);
    }
    update();
  }

  function renderRecent() {
    const section = $('recentSection');
    const list = $('recentList');
    section.hidden = recent.length === 0;
    list.replaceChildren();
    for (const entry of recent) {
      const button = document.createElement('button');
      button.type = 'button';
      const label = document.createElement('span');
      label.textContent = entry.label;
      const arrow = document.createElement('b');
      arrow.textContent = '↗';
      button.append(label, arrow);
      button.addEventListener('click', () => openUrl(entry.url, entry.label));
      list.append(button);
    }
  }

  function legacyUrl(kind) {
    const info = purchaseInfo();
    const number = onlyDigits(fields.tender.value);
    const reference = `${number}${info.year}`;
    if (info.uasg.length !== 6 || !number || !info.year) return '';
    if (kind === 'ata') return `http://comprasnet.gov.br/livre/Pregao/ata2.asp?co_no_uasg=${info.uasg}&numprp=${reference}`;
    if (kind === 'edital') return `http://comprasnet.gov.br/ConsultaLicitacoes/Download/Download.asp?coduasg=${info.uasg}&numprp=${reference}&modprp=5&bidbird=N`;
    if (kind === 'andamento') return `http://comprasnet.gov.br/livre/Pregao/lista_pregao.asp?Opc=2&rdTpPregao=E&lstSrp=T&lstICMS=T&lstSituacao=5&uf=&numprp=0&co_uasg=${info.uasg}&dt_entrega=&dt_abertura=&lstTipoSuspensao=0`;
    if (kind === 'agendados') return `http://comprasnet.gov.br/livre/Pregao/lista_pregao.asp?Opc=0&rdTpPregao=E&lstSrp=T&lstICMS=T&lstSituacao=5&uf=&numprp=0&co_uasg=${info.uasg}&dt_entrega=&dt_abertura=&lstTipoSuspensao=0`;
    return `https://www2.comprasnet.gov.br/siasgnet-atasrp/public/pesquisarItemSRP.do?method=iniciar&parametro.identificacaoCompra.numeroUasg=${info.uasg}&parametro.identificacaoCompra.modalidadeCompra=5&parametro.identificacaoCompra.numeroCompra=${number}&parametro.identificacaoCompra.anoCompra=${info.year}`;
  }

  function restoreForm() {
    const stored = readStored(FORM_KEY, {});
    fields.uasgInput.value = stored.uasgInput || '153065';
    fields.tender.value = stored.tender || '2';
    fields.year.value = stored.year || '2024';
    fields.item.value = stored.item || '1';
    fields.sipacRequest.value = stored.sipacRequest || '6042';
    fields.sipacYear.value = stored.sipacYear || stored.year || String(THIS_YEAR);
    fields.sipacCommitment.value = stored.sipacCommitment || '801009';
    fields.management.value = stored.management || '15231';
    fields.commitment.value = stored.commitment || '801009';
    setMode(stored.mode);
  }

  function bindEvents() {
    $('currentModeBtn').addEventListener('click', () => setMode('current'));
    $('legacyModeBtn').addEventListener('click', () => setMode('legacy'));
    Object.values(fields).forEach(input => input.addEventListener('input', update));
    fields.year.addEventListener('input', () => { fields.year.value = onlyDigits(fields.year.value).slice(0, 4); update(); });
    fields.item.addEventListener('input', () => { fields.item.value = onlyDigits(fields.item.value).slice(0, 5); update(); });
    fields.sipacYear.addEventListener('input', () => { fields.sipacYear.value = onlyDigits(fields.sipacYear.value).slice(0, 4); update(); });
    fields.management.addEventListener('input', () => { fields.management.value = onlyDigits(fields.management.value).slice(0, 5); update(); });
    fields.commitment.addEventListener('input', () => { fields.commitment.value = onlyDigits(fields.commitment.value).slice(0, 6); update(); });
    fields.uasgInput.addEventListener('focus', renderSuggestions);
    fields.uasgInput.addEventListener('input', renderSuggestions);
    fields.uasgInput.addEventListener('blur', () => window.setTimeout(() => { $('uasgSuggestions').hidden = true; fields.uasgInput.setAttribute('aria-expanded', 'false'); }, 120));

    $('purchaseBtn').addEventListener('click', () => {
      const info = purchaseInfo();
      openUrl(info.purchaseUrl, `${info.uasg} · PE ${info.tender}/${info.year}`);
    });
    $('itemBtn').addEventListener('click', () => {
      const info = purchaseInfo();
      openUrl(info.itemUrl, `${info.uasg} · PE ${info.tender}/${info.year} · item ${info.item}`);
    });
    $('noticeBtn').addEventListener('click', () => {
      const info = purchaseInfo();
      openUrl(info.purchaseUrl, `${info.uasg} · PE ${info.tender}/${info.year}`);
      showToast('No Compras.gov.br, use Downloads relacionados à compra › Edital.');
    });
    $('copyBtn').addEventListener('click', async () => {
      const info = purchaseInfo();
      if (!info.purchaseUrl) return showToast('Preencha os campos para gerar o link.');
      try {
        await navigator.clipboard.writeText(info.itemUrl || info.purchaseUrl);
        showToast('Link copiado.');
      } catch {
        showToast('Não foi possível copiar automaticamente.');
      }
    });
    document.querySelectorAll('[data-legacy]').forEach(button => button.addEventListener('click', () => {
      const labels = { ata: 'Ata do pregão', edital: 'Download do edital', andamento: 'Pregões em andamento', agendados: 'Pregões agendados', srp: 'Itens de ata SRP' };
      const kind = button.dataset.legacy;
      openUrl(legacyUrl(kind), `${labels[kind]} · ${purchaseInfo().uasg}`);
    }));

    $('sipacRequestBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacRequest.value);
      const year = onlyDigits(fields.sipacYear.value);
      openUrl(number && year ? `https://sipac.ufpb.br/sipac/buscaRequisicao.do?requisicao.numero=${number}&requisicao.ano=${year}` : '', `SIPAC · Requisição ${number}/${year}`);
    });
    $('sipacCommitmentBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacCommitment.value);
      const year = onlyDigits(fields.sipacYear.value);
      openUrl(number && year ? `https://sipac.ufpb.br/sipac/consultaEmpenho.do?numero=${number}&ano=${year}&idUnidadeGestora=605&acao=13` : '', `SIPAC · Empenho ${number}/${year}`);
    });
    $('transparencyBtn').addEventListener('click', () => {
      const info = purchaseInfo();
      const management = onlyDigits(fields.management.value).padStart(5, '0');
      const commitment = onlyDigits(fields.commitment.value).padStart(6, '0');
      const url = info.uasg && info.year && management && commitment ? `https://portaldatransparencia.gov.br/despesas/documento/empenho/${info.uasg}${management}${info.year}NE${commitment}` : '';
      openUrl(url, `Portal da Transparência · ${info.year}NE${commitment}`);
    });
    $('clearRecentBtn').addEventListener('click', () => {
      recent = [];
      localStorage.removeItem(RECENT_KEY);
      renderRecent();
    });

    $('installBtn').addEventListener('click', async () => {
      if (installed) return showToast('O app já está instalado neste aparelho.');
      if (!installPrompt) return openInstallHelp();
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') showToast('Instalação iniciada.');
      installPrompt = null;
    });
    $('closeInstallBtn').addEventListener('click', closeInstallHelp);
    $('confirmInstallBtn').addEventListener('click', closeInstallHelp);
    $('installModal').addEventListener('mousedown', event => { if (event.target === $('installModal')) closeInstallHelp(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeInstallHelp(); });
  }

  function openInstallHelp() {
    $('installModal').hidden = false;
    $('closeInstallBtn').focus();
  }

  function closeInstallHelp() {
    $('installModal').hidden = true;
  }

  async function loadUasgs() {
    try {
      const response = await fetch('uasgs.json');
      if (!response.ok) throw new Error('Base indisponível');
      const records = await response.json();
      if (Array.isArray(records) && records.length) uasgs = records;
    } catch {
      uasgs = UFPB_FALLBACK;
    } finally {
      dataReady = true;
      $('datasetDot').classList.add('ready');
      $('datasetStatus').textContent = `${uasgs.length.toLocaleString('pt-BR')} UASGs disponíveis`;
      renderUfpb();
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    $('installLabel').textContent = 'Instalado';
  });

  restoreForm();
  bindEvents();
  renderUfpb();
  renderRecent();
  update();
  loadUasgs();
  if (installed) $('installLabel').textContent = 'Instalado';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => undefined);
})();
