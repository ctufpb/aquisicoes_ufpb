(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const FORM_KEY = 'pregao-facil.form';
  const LEGACY_RECENT_KEY = 'pregao-facil.recent';
  const COMPRAS_RECENT_KEY = 'pregao-facil.recent.compras';
  const SIPAC_RECENT_KEY = 'pregao-facil.recent.sipac';
  const PROCESS_RECENT_KEY = 'pregao-facil.recent.processes';
  const PROCESS_FAVORITES_KEY = 'pregao-facil.favorite-processes';
  const LAST_PROCESS_KEY = 'pregao-facil.last-process';
  const FAVORITES_KEY = 'pregao-facil.favorite-uasgs';
  const DEVICE_ID_KEY = 'pregao-facil.anonymous-device-id';
  const UFPB_CNPJ = '24098477000110';
  const SHARED_API_ORIGIN = 'https://pregao-facil-ufpb.lincolnpontes.chatgpt.site';
  const DEFAULT_FORM_YEAR = '2026';
  const EMPENHO_WEB_START_YEAR = 2021;
  const CURRENT_PREGAO_START_YEAR = 2022;
  const CURRENT_ONLY_START_YEAR = 2024;
  const UFPB_FALLBACK = [
    { c: '153065', n: 'UNIVERSIDADE FEDERAL DA PARAÍBA - CAMPUS I', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '153066', n: 'PREFEITURA UNIVERSITÁRIA DA UFPB', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '153068', n: 'CENTRO DE CIÊNCIAS EXATAS E DA NATUREZA', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '153070', n: 'BIBLIOTECA CENTRAL DA UFPB', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '153071', n: 'HOSPITAL UNIVERSITÁRIO LAURO WANDERLEY', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '153072', n: 'LABORATÓRIO DE TECNOLOGIA FARMACÊUTICA', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '153073', n: 'CENTRO DE CIÊNCIAS AGRÁRIAS DA UFPB', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '153074', n: 'CENTRO DE CIÊNCIAS HUMANAS, SOCIAIS E AGRÁRIAS', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '153076', n: 'CENTRO DE FORMAÇÃO DE PROFESSORES DA UFPB', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ },
    { c: '155916', n: 'UFPB - CAMPUS IV LITORAL NORTE', uf: 'PB', a: 1, u: 1, o: UFPB_CNPJ }
  ];
  const DEFAULT_FAVORITES = UFPB_FALLBACK.map(record => record.c);

  let mode = 'current';
  let uasgs = UFPB_FALLBACK;
  let dataReady = false;
  const legacyRecent = normalizeRecentEntries(readStored(LEGACY_RECENT_KEY, []));
  const storedComprasRecent = readStored(COMPRAS_RECENT_KEY, null);
  const storedSipacRecent = readStored(SIPAC_RECENT_KEY, null);
  const storedProcessRecent = readStored(PROCESS_RECENT_KEY, null);
  let comprasRecent = Array.isArray(storedComprasRecent)
    ? normalizeRecentEntries(storedComprasRecent)
    : legacyRecent.filter(entry => !isSipacEntry(entry) && !isTransparencyEntry(entry));
  let sipacRecent = Array.isArray(storedSipacRecent)
    ? normalizeRecentEntries(storedSipacRecent)
    : legacyRecent.filter(entry => isSipacEntry(entry) && !isProcessEntry(entry));
  let processRecent = Array.isArray(storedProcessRecent)
    ? normalizeProcessEntries(storedProcessRecent)
    : normalizeProcessEntries(legacyRecent.filter(isProcessEntry));
  let favoriteProcesses = normalizeProcessEntries(readStored(PROCESS_FAVORITES_KEY, []), Number.POSITIVE_INFINITY);
  const storedFavorites = readStored(FAVORITES_KEY, null);
  let favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites : DEFAULT_FAVORITES);
  let installPrompt = null;
  let installed = window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
  let toastTimer = 0;
  const pncpPurchaseCache = new Map();
  try {
    localStorage.removeItem('pregao-facil.pncp-purchases');
    localStorage.setItem(COMPRAS_RECENT_KEY, JSON.stringify(comprasRecent));
    localStorage.setItem(SIPAC_RECENT_KEY, JSON.stringify(sipacRecent));
    localStorage.setItem(PROCESS_RECENT_KEY, JSON.stringify(processRecent));
    localStorage.removeItem(LEGACY_RECENT_KEY);
  } catch { /* Migração local ignorada quando o armazenamento não estiver disponível. */ }

  const fields = {
    uasgInput: $('uasgInput'),
    tender: $('tenderInput'),
    year: $('yearInput'),
    item: $('itemInput'),
    sipacRequest: $('sipacRequestInput'),
    sipacYear: $('sipacYearInput'),
    sipacCommitment: $('sipacCommitmentInput'),
    sipacCommitmentYear: $('sipacCommitmentYearInput'),
    sipacContract: $('sipacContractInput'),
    sipacContractYear: $('sipacContractYearInput'),
    sipacTerm: $('sipacTermInput'),
    sipacTermYear: $('sipacTermYearInput'),
    sipacGuide: $('sipacGuideInput'),
    sipacGuideYear: $('sipacGuideYearInput'),
    sipacProcessNumber: $('sipacProcessNumberInput'),
    sipacProcessYear: $('sipacProcessYearInput'),
    sipacAsset: $('sipacAssetInput'),
    transparencyUasg: $('transparencyUasgInput'),
    management: $('managementInput'),
    transparencyYear: $('transparencyYearInput'),
    commitment: $('commitmentInput')
  };
  const yearFields = [
    fields.year,
    fields.sipacYear,
    fields.sipacCommitmentYear,
    fields.sipacContractYear,
    fields.sipacTermYear,
    fields.sipacGuideYear,
    fields.sipacProcessYear,
    fields.transparencyYear
  ];

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatTombamento(value) {
    const digits = onlyDigits(value).slice(0, 12);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const prefix = digits.slice(0, -6);
    const suffix = digits.slice(-6);
    return `${prefix}-${suffix.slice(0, 3)}.${suffix.slice(3)}`;
  }

  function normalizeRecentEntries(entries, limit = 5) {
    if (!Array.isArray(entries)) return [];
    const normalized = [];
    for (const entry of entries) {
      const label = String(entry?.label || '').trim();
      const url = String(entry?.url || '').trim();
      if (!label || !url || normalized.some(item => item.url === url)) continue;
      normalized.push({ label, url, at: Number(entry?.at) || Date.now() });
      if (normalized.length >= limit) break;
    }
    return normalized;
  }

  function isTransparencyEntry(entry) {
    return /^Portal da Transparência\b/i.test(String(entry?.label || ''));
  }

  function isProcessEntry(entry) {
    return /^SIPAC (Público|Logado)\b/i.test(String(entry?.label || '')) || Boolean(entry?.processNumber);
  }

  function isSipacEntry(entry) {
    return /^SIPAC\b/i.test(String(entry?.label || ''));
  }

  function normalizeProcessEntries(entries, limit = 3) {
    if (!Array.isArray(entries)) return [];
    const normalized = [];
    for (const entry of entries) {
      const source = `${entry?.processNumber || ''} ${entry?.label || ''}`;
      const processNumber = source.match(/23074\.\d{1,6}\/\d{4}-99/)?.[0] || '';
      const url = String(entry?.url || '').trim();
      if (!processNumber || !url || normalized.some(item => item.processNumber === processNumber)) continue;
      const accessMode = entry?.accessMode === 'logged' || /SIPAC Logado/i.test(String(entry?.label || '')) ? 'logged' : 'public';
      normalized.push({
        processNumber,
        accessMode,
        accessLabel: accessMode === 'logged' ? 'SIPAC Logado' : 'SIPAC Público',
        url,
        at: Number(entry?.at) || Date.now()
      });
      if (normalized.length >= limit) break;
    }
    return normalized;
  }

  function storeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Persistência local opcional. */ }
  }

  function sharedApiUrl(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return window.location.hostname.endsWith('.chatgpt.site')
      ? normalizedPath
      : `${SHARED_API_ORIGIN}${normalizedPath}`;
  }

  function normalizedSipacProcess() {
    const sequence = onlyDigits(fields.sipacProcessNumber.value).slice(0, 6);
    const year = onlyDigits(fields.sipacProcessYear.value).slice(0, 4);
    if (!sequence || year.length !== 4) return '';
    return `23074.${sequence.padStart(6, '0')}/${year}-99`;
  }

  function updateSipacProcessLinks() {
    const processNumber = normalizedSipacProcess();
    for (const [id, accessMode] of [['sipacProcessPublicBtn', 'public'], ['sipacProcessLoggedBtn', 'logged']]) {
      const link = $(id);
      link.href = processNumber
        ? sharedApiUrl(`/sipac-process?numero=${encodeURIComponent(processNumber)}&mode=${accessMode}`)
        : '#';
      link.setAttribute('aria-disabled', String(!processNumber));
    }
  }

  function sipacAssetSearchUrl() {
    const tombamento = onlyDigits(fields.sipacAsset.value).slice(0, 12);
    if (!tombamento) return '';
    const params = new URLSearchParams({
      tipoRelatorio: '1',
      view: 'consultaBens',
      titulo: 'Consultar Bens',
      infoBem: 'true',
      opcoesBusca: '36',
      tombamento,
      consultar: 'true',
      tipoOrdenacao: '1',
      tipoAgrupamento: '6',
      formatoSaida: '1'
    });
    return `https://sipac.ufpb.br/sipac/gerarRelatorioBens.do?${params.toString()}`;
  }

  function updateSipacAssetLink() {
    const link = $('sipacAssetBtn');
    const url = sipacAssetSearchUrl();
    link.href = url
      ? 'https://sipac.ufpb.br/sipac/prepararRelatorioPatrimonio.do?view=consultaBens&acao=consultar&tipo=1'
      : '#';
    link.setAttribute('aria-disabled', String(!url));
  }

  function openSipacAssetSearch(tombamento) {
    const prepareUrl = 'https://sipac.ufpb.br/sipac/prepararRelatorioPatrimonio.do?view=consultaBens&acao=consultar&tipo=1';
    const resultUrl = sipacAssetSearchUrl();
    const searchTab = window.open(prepareUrl, 'sipacAssetSearch');
    if (!searchTab) {
      showToast('O navegador bloqueou a nova aba. Permita a abertura e tente novamente.');
      return;
    }
    rememberSipac(`SIPAC · Bem ${formatTombamento(tombamento)}`, resultUrl);
    showToast('Preparando a consulta no SIPAC…');
    window.setTimeout(() => {
      const resultTab = window.open(resultUrl, 'sipacAssetSearch');
      if (!resultTab) {
        showToast('Volte ao app e toque novamente em “Consultar bem”.');
      }
    }, 2400);
  }

  function openSipacContractSearch(number, year) {
    const query = new URLSearchParams({
      acao: '145',
      ano: 'on',
      anoInicial: year,
      numero: 'on',
      numeroContrato: number
    });
    const url = `https://sipac.ufpb.br/sipac/buscaContratos.do?${query}`;
    const searchTab = window.open(url, 'sipacContractSearch');
    if (!searchTab) {
      showToast('O navegador bloqueou a nova aba. Permita a abertura e tente novamente.');
      return;
    }
    rememberSipac(`SIPAC · Contrato ${number}/${year}`, url);
    showToast('No SIPAC, clique em “Listar” para concluir a pesquisa do contrato.');
  }

  function anonymousDeviceId() {
    try {
      const stored = localStorage.getItem(DEVICE_ID_KEY);
      if (/^[a-f0-9-]{20,64}$/i.test(stored || '')) return stored;
      const created = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(DEVICE_ID_KEY, created);
      return created;
    } catch {
      return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  async function recordAnonymousVisit() {
    const format = new Intl.NumberFormat('pt-BR');
    const accessMetric = (total, unique) => `${format.format(Number(total) || 0)} (${format.format(Number(unique) || 0)})`;
    try {
      const response = await fetch(sharedApiUrl('/analytics/visit'), {
        method: 'POST',
        cache: 'no-store',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: anonymousDeviceId() })
      });
      if (!response.ok) throw new Error('Contagem indisponível');
      const summary = await response.json();
      $('usageToday').textContent = accessMetric(summary.todayTotal ?? summary.today, summary.todayUnique ?? summary.today);
      $('usageWeek').textContent = accessMetric(summary.weekTotal ?? summary.week, summary.weekUnique ?? summary.week);
      $('usageMonth').textContent = accessMetric(summary.monthTotal ?? summary.month, summary.monthUnique ?? summary.month);
      $('savedEditais').textContent = format.format(Number(summary.savedEditais) || 0);
      $('savedAtas').textContent = format.format(Number(summary.savedAtas) || 0);
      $('usageStatus').textContent = 'Total de acessos (aparelhos únicos aproximados); nenhum dado pessoal é armazenado.';
    } catch {
      $('usageStatus').textContent = 'Contagem temporariamente indisponível.';
    }
  }

  function isFourDigitYear(value) {
    return /^\d{4}$/.test(String(value || ''));
  }

  function requireFourDigitYear(field) {
    if (isFourDigitYear(field.value)) return field.value;
    field.setAttribute('aria-invalid', 'true');
    field.focus();
    showToast('Informe o ano obrigatoriamente com 4 dígitos.');
    return '';
  }

  function noticeError(state, message) {
    const error = new Error(message);
    error.noticeState = state;
    return error;
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function tenderCurrent(value, yearValue) {
    const raw = onlyDigits(value);
    if (!raw) return '';
    const year = Number(yearValue);
    const usesNewNumbering = year >= CURRENT_ONLY_START_YEAR;
    const normalized = raw.length <= 4 && usesNewNumbering ? 90000 + Number(raw) : Number(raw);
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
      sipacCommitmentYear: fields.sipacCommitmentYear.value,
      sipacContract: fields.sipacContract.value,
      sipacContractYear: fields.sipacContractYear.value,
      sipacTerm: fields.sipacTerm.value,
      sipacTermYear: fields.sipacTermYear.value,
      sipacGuide: fields.sipacGuide.value,
      sipacGuideYear: fields.sipacGuideYear.value,
      sipacProcessNumber: fields.sipacProcessNumber.value,
      sipacProcessYear: fields.sipacProcessYear.value,
      sipacAsset: onlyDigits(fields.sipacAsset.value),
      transparencyUasg: fields.transparencyUasg.value,
      management: fields.management.value,
      transparencyYear: fields.transparencyYear.value,
      commitment: fields.commitment.value
    };
  }

  function saveForm() {
    localStorage.setItem(FORM_KEY, JSON.stringify(formValues()));
  }

  function purchaseInfo() {
    const uasg = onlyDigits(fields.uasgInput.value).slice(0, 6);
    const year = /^\d{4}$/.test(fields.year.value) ? fields.year.value : '';
    const tender = tenderCurrent(fields.tender.value, year);
    const item = Math.max(1, Number(onlyDigits(fields.item.value)) || 1);
    const key = uasg.length === 6 && tender && year ? `${uasg}05${tender}${year}` : '';
    return {
      uasg,
      tender,
      year,
      item,
      key,
      purchaseUrl: key ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${key}` : '',
      itemUrl: key ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra/item/${item}?compra=${key}` : ''
    };
  }

  function transparencyUasgCode() {
    return onlyDigits(fields.transparencyUasg.value).slice(0, 6);
  }

  function isUfpbUnit(record) {
    return Boolean(record && record.o === UFPB_CNPJ);
  }

  function applyManagementForUnit(record) {
    if (isUfpbUnit(record)) {
      fields.management.value = '15231';
      fields.management.dataset.autofilled = 'true';
    } else if (fields.management.dataset.autofilled === 'true') {
      fields.management.value = '';
      fields.management.dataset.autofilled = 'false';
    }
  }

  function pncpResolverUrl(kind, info, unit) {
    if (!info.key || !unit?.o) return '#';
    const params = new URLSearchParams({
      tipo: kind,
      compra: info.key,
      cnpj: unit.o,
      uasg: info.uasg,
      pregao: info.tender,
      ano: info.year
    });
    return `pncp-resolver.html?${params}`;
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4200);
  }

  function rememberCompras(label, url) {
    comprasRecent = [{ label, url, at: Date.now() }, ...comprasRecent.filter(entry => entry.url !== url)].slice(0, 5);
    storeLocal(COMPRAS_RECENT_KEY, comprasRecent);
    renderRecent();
  }

  function rememberSipac(label, url) {
    sipacRecent = [{ label, url, at: Date.now() }, ...sipacRecent.filter(entry => entry.url !== url)].slice(0, 5);
    storeLocal(SIPAC_RECENT_KEY, sipacRecent);
    renderSipacRecent();
  }

  function rememberProcess(processNumber, accessMode, url) {
    const entry = {
      processNumber,
      accessMode,
      accessLabel: accessMode === 'logged' ? 'SIPAC Logado' : 'SIPAC Público',
      url,
      at: Date.now()
    };
    processRecent = [entry, ...processRecent.filter(item => item.processNumber !== processNumber)].slice(0, 3);
    favoriteProcesses = favoriteProcesses.map(item => item.processNumber === processNumber ? entry : item);
    storeLocal(PROCESS_RECENT_KEY, processRecent);
    storeLocal(PROCESS_FAVORITES_KEY, favoriteProcesses);
    storeLocal(LAST_PROCESS_KEY, { processNumber });
    renderProcessHistory();
  }

  function openUrl(url, label, history = 'compras') {
    if (!url) {
      showToast('Confira os campos da consulta.');
      return;
    }
    if (history === 'sipac') rememberSipac(label, url);
    else if (history === 'compras') rememberCompras(label, url);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function update() {
    const info = purchaseInfo();
    for (const field of yearFields) {
      field.setAttribute('aria-invalid', String(!isFourDigitYear(field.value)));
    }
    const selected = uasgs.find(record => record.c === info.uasg);
    $('pncpNoticeBtn').href = pncpResolverUrl('edital', info, selected);
    $('pncpAtaBtn').href = pncpResolverUrl('ata', info, selected);
    $('uasgHelp').textContent = selected
      ? selected.n
      : dataReady
        ? 'Digite o código ou o nome e escolha uma UASG.'
        : 'Carregando base de UASGs…';
    const transparencyUasg = transparencyUasgCode();
    const transparencyUnit = uasgs.find(record => record.c === transparencyUasg);
    $('transparencyUasgHelp').textContent = transparencyUnit
      ? transparencyUnit.n
      : dataReady
        ? 'Digite o código ou o nome e escolha uma UASG.'
        : 'Carregando base de UASGs…';
    $('tenderHelp').textContent = mode === 'current' && info.tender ? `Será usado ${info.tender}` : 'Número sem o ano';
    $('itemBtn').childNodes[0].nodeValue = `Ver item ${info.item} `;
    const purchaseYear = isFourDigitYear(fields.year.value) ? Number(fields.year.value) : 0;
    const transitionYear = purchaseYear >= CURRENT_PREGAO_START_YEAR && purchaseYear < CURRENT_ONLY_START_YEAR;
    const modeYearAdvisory = $('modeYearAdvisory');
    let modeYearMessage = '';
    if (purchaseYear) {
      if (mode === 'current' && purchaseYear < CURRENT_PREGAO_START_YEAR) {
        modeYearMessage = 'Este ano pertence à consulta anterior. Clique em “Pregões antigos”.';
      } else if (mode === 'legacy' && purchaseYear >= CURRENT_ONLY_START_YEAR) {
        modeYearMessage = 'Este ano pertence à consulta atual. Clique em “Atual”.';
      } else if (transitionYear && mode === 'current') {
        modeYearMessage = 'Ano de transição: se não encontrar aqui, tente “Pregões antigos”.';
      } else if (transitionYear) {
        modeYearMessage = 'Ano de transição: esta contratação também pode estar em “Atual”.';
      }
    }
    modeYearAdvisory.hidden = !modeYearMessage;
    modeYearAdvisory.textContent = modeYearMessage;
    const transparencyYear = isFourDigitYear(fields.transparencyYear.value) ? fields.transparencyYear.value : '';
    $('transparencyPreview').textContent = `${transparencyYear || '—'}NE${onlyDigits(fields.commitment.value).padStart(6, '0')}`;
    const historicalMessage = 'Atenção: para anos até 2020, confira também a faixa histórica 800001–999999. O Empenho Web passou a estruturar esses dados a partir de 2021.';
    const sipacHistorical = isFourDigitYear(fields.sipacCommitmentYear.value) && Number(fields.sipacCommitmentYear.value) < EMPENHO_WEB_START_YEAR;
    const transparencyHistorical = isFourDigitYear(fields.transparencyYear.value) && Number(fields.transparencyYear.value) < EMPENHO_WEB_START_YEAR;
    $('sipacCommitmentAdvisory').hidden = !sipacHistorical;
    $('sipacCommitmentAdvisory').textContent = sipacHistorical ? historicalMessage : '';
    $('transparencyYearAdvisory').hidden = !transparencyHistorical;
    $('transparencyYearAdvisory').textContent = transparencyHistorical ? historicalMessage : '';
    if (!$('noticeStatus').classList.contains('loading')) {
      $('noticeStatus').textContent = 'Os links do PNCP e o edital serão localizados automaticamente.';
      $('noticeStatus').dataset.state = 'idle';
    }
    updateSipacProcessLinks();
    updateSipacAssetLink();
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

  function chooseUasg(record, input = fields.uasgInput, box = $('uasgSuggestions')) {
    input.value = record.c;
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    update();
  }

  function chooseTransparencyUasg(record) {
    fields.transparencyUasg.value = record.c;
    applyManagementForUnit(record);
    $('transparencyUasgSuggestions').hidden = true;
    fields.transparencyUasg.setAttribute('aria-expanded', 'false');
    update();
  }

  function rankFavorites(records) {
    return records.sort((left, right) =>
      Number(favorites.has(right.c)) - Number(favorites.has(left.c)) ||
      right.a - left.a ||
      left.c.localeCompare(right.c)
    );
  }

  function matchingUasgs(value) {
    const query = normalizeText(value);
    if (!query) {
      return rankFavorites(uasgs.filter(record => record.a)).slice(0, 10);
    }

    if (/^\d{6}$/.test(query)) {
      const exact = uasgs.find(record => record.c === query);
      const favoritesWithoutExact = rankFavorites(uasgs.filter(record => record.a && record.c !== query));
      return exact ? [exact, ...favoritesWithoutExact].slice(0, 10) : favoritesWithoutExact.slice(0, 10);
    }

    const numeric = onlyDigits(query);
    const prefix = [];
    const contains = [];
    for (const record of uasgs) {
      const name = normalizeText(record.n);
      if (record.c.startsWith(numeric || query) || name.startsWith(query)) prefix.push(record);
      else if (record.c.includes(numeric || query) || name.includes(query)) contains.push(record);
      if (prefix.length + contains.length >= 100) break;
    }
    return [...rankFavorites(prefix), ...rankFavorites(contains)].slice(0, 10);
  }

  function toggleFavorite(record, rerender) {
    if (favorites.has(record.c)) favorites.delete(record.c);
    else favorites.add(record.c);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    rerender();
    showToast(favorites.has(record.c) ? `UASG ${record.c} adicionada aos favoritos.` : `UASG ${record.c} removida dos favoritos.`);
  }

  function renderUasgSuggestions(input, box, selectedCode, choose, rerender) {
    box.replaceChildren();
    const matches = matchingUasgs(input.value);
    for (const record of matches) {
      const row = document.createElement('div');
      row.className = 'suggestion-row';
      row.role = 'option';
      row.setAttribute('aria-selected', String(record.c === selectedCode));

      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.className = 'suggestion-main';
      selectButton.addEventListener('mousedown', event => event.preventDefault());
      selectButton.addEventListener('click', () => choose(record));

      const code = document.createElement('span');
      code.className = favorites.has(record.c) ? 'uasg-code favorite' : 'uasg-code';
      code.textContent = record.c;
      const details = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = record.n;
      details.append(name);
      selectButton.append(code, details);

      const favoriteButton = document.createElement('button');
      const isFavorite = favorites.has(record.c);
      favoriteButton.type = 'button';
      favoriteButton.className = isFavorite ? 'favorite-button is-favorite' : 'favorite-button';
      favoriteButton.textContent = isFavorite ? '★' : '☆';
      favoriteButton.title = isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
      favoriteButton.setAttribute('aria-label', `${favoriteButton.title}: UASG ${record.c}`);
      favoriteButton.addEventListener('mousedown', event => event.preventDefault());
      favoriteButton.addEventListener('click', () => toggleFavorite(record, rerender));

      row.append(selectButton, favoriteButton);
      box.append(row);
    }
    box.hidden = matches.length === 0;
    input.setAttribute('aria-expanded', String(matches.length > 0));
  }

  function renderSuggestions() {
    renderUasgSuggestions(fields.uasgInput, $('uasgSuggestions'), purchaseInfo().uasg, record => chooseUasg(record), renderSuggestions);
  }

  function renderTransparencySuggestions() {
    renderUasgSuggestions(fields.transparencyUasg, $('transparencyUasgSuggestions'), transparencyUasgCode(), chooseTransparencyUasg, renderTransparencySuggestions);
  }

  function renderRecent() {
    const list = $('recentList');
    list.replaceChildren();
    if (!comprasRecent.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-history';
      empty.textContent = 'As consultas do Compras.gov aparecerão aqui.';
      list.append(empty);
      return;
    }
    for (const entry of comprasRecent) {
      const button = document.createElement('button');
      button.type = 'button';
      const label = document.createElement('span');
      label.textContent = entry.label;
      const arrow = document.createElement('b');
      arrow.textContent = '🔎';
      button.append(label, arrow);
      button.addEventListener('click', () => openUrl(entry.url, entry.label));
      list.append(button);
    }
  }

  function renderSipacRecent() {
    const list = $('sipacRecentList');
    list.replaceChildren();
    if (!sipacRecent.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-history';
      empty.textContent = 'As consultas do SIPAC aparecerão aqui.';
      list.append(empty);
      return;
    }
    for (const entry of sipacRecent) {
      const button = document.createElement('button');
      button.type = 'button';
      const label = document.createElement('span');
      const displayLabel = entry.label.replace(/^SIPAC · /, '');
      label.textContent = displayLabel.replace(/^Bem (\d+)$/, (_, digits) => `Bem ${formatTombamento(digits)}`);
      const search = document.createElement('b');
      search.textContent = '🔎';
      button.append(label, search);
      button.addEventListener('click', () => openUrl(entry.url, entry.label, 'sipac'));
      list.append(button);
    }
  }

  function toggleProcessFavorite(entry) {
    const isFavorite = favoriteProcesses.some(item => item.processNumber === entry.processNumber);
    favoriteProcesses = isFavorite
      ? favoriteProcesses.filter(item => item.processNumber !== entry.processNumber)
      : [entry, ...favoriteProcesses.filter(item => item.processNumber !== entry.processNumber)];
    storeLocal(PROCESS_FAVORITES_KEY, favoriteProcesses);
    renderProcessHistory();
  }

  function renderProcessHistory() {
    const list = $('processHistoryList');
    list.replaceChildren();
    const favoriteNumbers = new Set(favoriteProcesses.map(entry => entry.processNumber));
    const entries = [...favoriteProcesses, ...processRecent.filter(entry => !favoriteNumbers.has(entry.processNumber))];
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-history';
      empty.textContent = 'Os 3 últimos processos aparecerão aqui.';
      list.append(empty);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'process-history-row';

      const link = document.createElement('a');
      link.className = 'process-history-open';
      link.href = entry.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const number = document.createElement('strong');
      number.textContent = entry.processNumber;
      const access = document.createElement('small');
      access.textContent = entry.accessLabel;
      const separator = document.createElement('span');
      separator.className = 'process-history-separator';
      separator.textContent = '—';
      const details = document.createElement('span');
      details.className = 'process-history-details';
      details.append(number, separator, access);
      const search = document.createElement('b');
      search.className = 'process-history-search';
      search.textContent = '🔎';
      search.setAttribute('aria-hidden', 'true');
      link.append(details, search);
      link.addEventListener('click', () => rememberProcess(entry.processNumber, entry.accessMode, entry.url));

      const favoriteButton = document.createElement('button');
      const isFavorite = favoriteNumbers.has(entry.processNumber);
      favoriteButton.type = 'button';
      favoriteButton.className = isFavorite ? 'favorite-button is-favorite' : 'favorite-button';
      favoriteButton.textContent = '★';
      favoriteButton.setAttribute('aria-label', isFavorite ? `Desfavoritar processo ${entry.processNumber}` : `Favoritar processo ${entry.processNumber}`);
      favoriteButton.addEventListener('click', () => toggleProcessFavorite(entry));

      row.append(link, favoriteButton);
      list.append(row);
    }
  }

  function srpUrl(info, number) {
    if (info.uasg.length !== 6 || !number || !info.year) return '';
    return `https://www2.comprasnet.gov.br/siasgnet-atasrp/public/pesquisarItemSRP.do?method=iniciar&parametro.identificacaoCompra.numeroUasg=${info.uasg}&parametro.identificacaoCompra.modalidadeCompra=5&parametro.identificacaoCompra.numeroCompra=${number}&parametro.identificacaoCompra.anoCompra=${info.year}`;
  }

  function legacyUrl(kind) {
    const info = purchaseInfo();
    const number = onlyDigits(fields.tender.value);
    const reference = `${number}${info.year}`;
    if (info.uasg.length !== 6 || !number || !info.year) return '';
    if (kind === 'ata') return `https://comprasnet.gov.br/livre/pregao/ata2.asp?co_no_uasg=${info.uasg}&numprp=${reference}&codigoModalidade=5`;
    if (kind === 'edital') return `http://comprasnet.gov.br/ConsultaLicitacoes/Download/Download.asp?coduasg=${info.uasg}&numprp=${reference}&modprp=5&bidbird=N`;
    return srpUrl(info, number);
  }

  function wait(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  async function fetchJsonOnce(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) throw new Error(`Resposta ${response.status}`);
      return response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function fetchPncpJson(url, errorMessage) {
    const routes = [
      { url: sharedApiUrl(`/pncp-proxy?target=${encodeURIComponent(url)}`), attempts: 2 },
      { url, attempts: 1 }
    ];

    for (const route of routes) {
      for (let attempt = 1; attempt <= route.attempts; attempt += 1) {
        try {
          return await fetchJsonOnce(route.url);
        } catch {
          if (attempt < route.attempts) await wait(attempt * 650);
        }
      }
    }
    throw new Error(errorMessage);
  }

  function rememberPncpPurchase(cacheKey, purchase) {
    const compact = {
      anoCompra: purchase.anoCompra,
      sequencialCompra: purchase.sequencialCompra,
      numeroControlePNCP: purchase.numeroControlePNCP || ''
    };
    pncpPurchaseCache.set(cacheKey, compact);
    return compact;
  }

  async function findPurchaseOnComprasGov(info, cnpj) {
    const purchaseYear = Number(info.year);
    for (const publicationYear of [purchaseYear, purchaseYear + 1]) {
      let page = 1;
      let totalPages = 1;
      do {
        const params = new URLSearchParams({
          pagina: String(page),
          tamanhoPagina: '500',
          unidadeOrgaoCodigoUnidade: info.uasg,
          orgaoEntidadeCnpj: cnpj,
          dataPublicacaoPncpInicial: `${publicationYear}-01-01`,
          dataPublicacaoPncpFinal: `${publicationYear}-12-31`,
          codigoModalidade: '5'
        });
        const result = await fetchPncpJson(
          `https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133?${params}`,
          'A pesquisa oficial do Compras.gov.br não respondeu.'
        );
        const purchase = (result.resultado || []).find(record =>
          String(record.idCompra || '') === info.key ||
          (
            String(record.numeroCompra || '').padStart(5, '0') === info.tender &&
            Number(record.anoCompraPncp) === purchaseYear &&
            String(record.unidadeOrgaoCodigoUnidade || '') === info.uasg
          )
        );
        if (purchase) {
          return {
            anoCompra: purchase.anoCompraPncp,
            sequencialCompra: purchase.sequencialCompraPncp,
            numeroControlePNCP: purchase.numeroControlePNCP || ''
          };
        }
        totalPages = Math.min(Number(result.totalPaginas) || 1, 25);
        page += 1;
      } while (page <= totalPages);
    }
    return null;
  }

  async function findPncpPurchase(info, cnpj) {
    const cacheKey = `${cnpj}:${info.uasg}:${info.tender}:${info.year}`;
    if (pncpPurchaseCache.has(cacheKey)) return pncpPurchaseCache.get(cacheKey);

    try {
      const comprasGovPurchase = await findPurchaseOnComprasGov(info, cnpj);
      if (comprasGovPurchase) return rememberPncpPurchase(cacheKey, comprasGovPurchase);
    } catch {
      // Se o Compras.gov.br estiver instável, a pesquisa segue pela API do PNCP.
    }

    const purchaseYear = Number(info.year);
    try {
      for (const publicationYear of [purchaseYear, purchaseYear + 1]) {
        let page = 1;
        let totalPages = 1;
        do {
          const params = new URLSearchParams({
            dataInicial: `${publicationYear}0101`,
            dataFinal: `${publicationYear}1231`,
            codigoModalidadeContratacao: '6',
            cnpj,
            codigoUnidadeAdministrativa: info.uasg,
            pagina: String(page),
            tamanhoPagina: '50'
          });
          const result = await fetchPncpJson(
            `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params}`,
            'Falha no acesso aos serviços oficiais.'
          );
          const purchase = (result.data || []).find(record =>
            String(record.numeroCompra || '').padStart(5, '0') === info.tender &&
            Number(record.anoCompra) === purchaseYear &&
            String(record.unidadeOrgao?.codigoUnidade || '') === info.uasg
          );
          if (purchase) return rememberPncpPurchase(cacheKey, purchase);
          totalPages = Math.min(Number(result.totalPaginas) || 1, 25);
          page += 1;
        } while (page <= totalPages);
      }
    } catch {
      throw noticeError('access', 'Falha no acesso: os serviços oficiais não responderam agora. Tente novamente em instantes.');
    }
    return null;
  }

  async function getPermanentNotice(purchaseKey) {
    try {
      const response = await fetch(sharedApiUrl(`/edital-cache?compra=${encodeURIComponent(purchaseKey)}`), {
        cache: 'no-store',
        headers: { accept: 'application/json' }
      });
      if (!response.ok) return null;
      const stored = await response.json();
      return typeof stored?.url === 'string' ? stored : null;
    } catch {
      return null;
    }
  }

  async function savePermanentNotice(info, cnpj, purchase, noticeUrl) {
    try {
      const response = await fetch(sharedApiUrl('/edital-cache'), {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          compra: info.key,
          url: noticeUrl,
          cnpj,
          anoCompra: Number(purchase.anoCompra),
          sequencialCompra: Number(purchase.sequencialCompra)
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function savePermanentPncpLinks(info, cnpj, purchase, ataSequence = null) {
    try {
      const response = await fetch(sharedApiUrl('/pncp-link-cache'), {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          compra: info.key,
          cnpj,
          anoCompra: Number(purchase.anoCompra),
          sequencialCompra: Number(purchase.sequencialCompra),
          sequencialAta: ataSequence
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  function startNoticeDownload(info, noticeUrl) {
    const label = `${info.uasg} · Edital PE ${info.tender}/${info.year}`;
    rememberCompras(label, noticeUrl);
    const downloadLink = document.createElement('a');
    downloadLink.href = noticeUrl;
    downloadLink.download = '';
    downloadLink.rel = 'noreferrer';
    downloadLink.hidden = true;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  }

  async function downloadCurrentNotice() {
    const status = $('noticeStatus');
    if (!requireFourDigitYear(fields.year)) {
      status.dataset.state = 'validation';
      status.textContent = 'Ano inválido: informe exatamente 4 dígitos.';
      return;
    }
    const info = purchaseInfo();
    const unit = uasgs.find(record => record.c === info.uasg);
    if (!info.key) return showToast('Preencha a UASG e o pregão para localizar o edital.');
    if (!unit?.o) return showToast('Não foi possível identificar o CNPJ desta UASG. Escolha a unidade novamente na lista.');

    const button = $('noticeBtn');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Verificando histórico…';
    status.classList.add('loading');
    status.dataset.state = 'loading';
    status.textContent = 'Verificando o histórico compartilhado…';

    try {
      const storedNotice = await getPermanentNotice(info.key);
      if (storedNotice?.url) {
        await savePermanentPncpLinks(info, storedNotice.cnpj, {
          anoCompra: storedNotice.anoCompra,
          sequencialCompra: storedNotice.sequencialCompra
        });
        startNoticeDownload(info, storedNotice.url);
        status.dataset.state = 'success';
        status.textContent = 'Edital recuperado do histórico compartilhado. O download foi iniciado.';
        showToast('Edital localizado no histórico compartilhado.');
        return;
      }

      button.textContent = 'Localizando edital…';
      status.textContent = 'Ainda não estava salvo. Consultando a publicação e os documentos no PNCP…';

      const purchase = await findPncpPurchase(info, unit.o);
      if (!purchase) throw noticeError('not-found', 'Ainda não publicado: esta contratação não foi localizada nas bases oficiais. Use “Contratação” para conferir no ComprasNet.');
      await savePermanentPncpLinks(info, unit.o, purchase);
      const documentUrls = [
        `https://pncp.gov.br/api/pncp/v1/orgaos/${unit.o}/compras/${purchase.anoCompra}/${purchase.sequencialCompra}/arquivos`,
        `https://pncp.gov.br/pncp-api/v1/orgaos/${unit.o}/compras/${purchase.anoCompra}/${purchase.sequencialCompra}/arquivos`
      ];
      let documents;
      for (const url of documentUrls) {
        try {
          documents = await fetchPncpJson(url, '');
          break;
        } catch {
          // Tenta a segunda rota pública oficial do PNCP.
        }
      }
      if (!Array.isArray(documents)) throw noticeError('access', 'Falha no acesso: o PNCP não respondeu à consulta dos documentos. Tente novamente em instantes.');
      const notice = (Array.isArray(documents) ? documents : []).find(document =>
        document.statusAtivo !== false && normalizeText(document.tipoDocumentoNome).includes('edital')
      );
      const noticeUrl = notice?.url || notice?.uri;
      if (!noticeUrl) throw noticeError('no-notice', 'Sem edital: a compra foi encontrada, mas o documento “Edital” ainda não está disponível no PNCP.');

      const storedPermanently = await savePermanentNotice(info, unit.o, purchase, noticeUrl);
      startNoticeDownload(info, noticeUrl);
      status.dataset.state = 'success';
      status.textContent = storedPermanently
        ? 'Edital localizado e salvo no histórico compartilhado. O download foi iniciado.'
        : 'Edital localizado. O download foi iniciado; o histórico compartilhado está temporariamente indisponível.';
      showToast(storedPermanently ? 'Edital salvo para as próximas consultas.' : 'Edital localizado no PNCP.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível localizar o edital.';
      status.dataset.state = error?.noticeState || 'access';
      status.textContent = message;
      showToast(message);
    } finally {
      button.disabled = false;
      button.innerHTML = originalText;
      status.classList.remove('loading');
    }
  }

  function restoreForm() {
    const stored = readStored(FORM_KEY, {});
    fields.uasgInput.value = stored.uasgInput || '153065';
    fields.tender.value = stored.tender || '2';
    fields.year.value = stored.year || DEFAULT_FORM_YEAR;
    fields.item.value = stored.item || '1';
    fields.sipacRequest.value = stored.sipacRequest || '123';
    fields.sipacYear.value = stored.sipacYear || DEFAULT_FORM_YEAR;
    fields.sipacCommitment.value = stored.sipacCommitment || '1234';
    fields.sipacCommitmentYear.value = stored.sipacCommitmentYear || DEFAULT_FORM_YEAR;
    fields.sipacContract.value = stored.sipacContract || '1';
    fields.sipacContractYear.value = stored.sipacContractYear || DEFAULT_FORM_YEAR;
    fields.sipacTerm.value = stored.sipacTerm || '123';
    fields.sipacTermYear.value = stored.sipacTermYear || DEFAULT_FORM_YEAR;
    fields.sipacGuide.value = stored.sipacGuide || '123';
    fields.sipacGuideYear.value = stored.sipacGuideYear || DEFAULT_FORM_YEAR;
    const lastProcessStored = readStored(LAST_PROCESS_KEY, null);
    const lastProcessValue = String(lastProcessStored?.processNumber || processRecent[0]?.processNumber || '23074.058753/2026-99');
    const lastProcessMatch = lastProcessValue.match(/^23074\.(\d{1,6})\/(\d{4})-99$/);
    fields.sipacProcessNumber.value = (lastProcessMatch?.[1] || '058753').padStart(6, '0').slice(0, 6);
    fields.sipacProcessYear.value = lastProcessMatch?.[2] || DEFAULT_FORM_YEAR;
    fields.sipacAsset.value = formatTombamento(stored.sipacAsset || '65164707');
    fields.transparencyUasg.value = stored.transparencyUasg || '153065';
    fields.management.value = stored.management || '15231';
    const restoredTransparencyUnit = uasgs.find(record => record.c === onlyDigits(fields.transparencyUasg.value));
    fields.management.dataset.autofilled = String(isUfpbUnit(restoredTransparencyUnit) && fields.management.value === '15231');
    fields.transparencyYear.value = stored.transparencyYear || DEFAULT_FORM_YEAR;
    fields.commitment.value = stored.commitment || '1234';
    setMode(stored.mode);
  }

  function selectEditablePart(input) {
    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) return;
      const length = input.value.length;
      if (yearFields.includes(input) && length > 0) {
        input.setSelectionRange(length - 1, length);
      } else {
        input.select();
      }
    });
  }

  function bindEnter(inputs, action) {
    for (const input of inputs) {
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        action();
      });
    }
  }

  function validatePncpLink(event) {
    const info = purchaseInfo();
    const unit = uasgs.find(record => record.c === info.uasg);
    if (!isFourDigitYear(fields.year.value) || !info.key || !unit?.o) {
      event.preventDefault();
      if (!isFourDigitYear(fields.year.value)) requireFourDigitYear(fields.year);
      else showToast('Confira a UASG e o número do pregão antes de consultar o PNCP.');
    }
  }

  function bindEvents() {
    $('currentModeBtn').addEventListener('click', () => setMode('current'));
    $('legacyModeBtn').addEventListener('click', () => setMode('legacy'));
    Object.values(fields).forEach(input => {
      input.addEventListener('input', update);
      input.addEventListener('focus', () => selectEditablePart(input));
      input.addEventListener('click', () => selectEditablePart(input));
    });
    yearFields.forEach(field => field.addEventListener('input', () => {
      field.value = onlyDigits(field.value).slice(0, 4);
      update();
    }));
    fields.item.addEventListener('input', () => { fields.item.value = onlyDigits(fields.item.value).slice(0, 5); update(); });
    fields.management.addEventListener('input', () => { fields.management.value = onlyDigits(fields.management.value).slice(0, 5); update(); });
    fields.commitment.addEventListener('input', () => { fields.commitment.value = onlyDigits(fields.commitment.value).slice(0, 6); update(); });
    fields.sipacContract.addEventListener('input', () => { fields.sipacContract.value = onlyDigits(fields.sipacContract.value).slice(0, 6); update(); });
    fields.sipacProcessNumber.addEventListener('input', () => {
      fields.sipacProcessNumber.value = onlyDigits(fields.sipacProcessNumber.value).slice(0, 6);
      update();
    });
    fields.sipacAsset.addEventListener('input', () => {
      fields.sipacAsset.value = formatTombamento(fields.sipacAsset.value);
      update();
    });
    fields.uasgInput.addEventListener('focus', renderSuggestions);
    fields.uasgInput.addEventListener('input', renderSuggestions);
    fields.uasgInput.addEventListener('blur', () => window.setTimeout(() => {
      $('uasgSuggestions').hidden = true;
      fields.uasgInput.setAttribute('aria-expanded', 'false');
    }, 140));
    fields.transparencyUasg.addEventListener('focus', renderTransparencySuggestions);
    fields.transparencyUasg.addEventListener('input', renderTransparencySuggestions);
    fields.transparencyUasg.addEventListener('blur', () => window.setTimeout(() => {
      $('transparencyUasgSuggestions').hidden = true;
      fields.transparencyUasg.setAttribute('aria-expanded', 'false');
      const record = uasgs.find(unit => unit.c === transparencyUasgCode());
      if (record) applyManagementForUnit(record);
      update();
    }, 140));
    fields.management.addEventListener('input', () => { fields.management.dataset.autofilled = 'false'; });

    bindEnter([fields.uasgInput, fields.tender, fields.year], () => {
      if (mode === 'current') $('purchaseBtn').click();
      else document.querySelector('[data-legacy="ata"]')?.click();
    });
    bindEnter([fields.item], () => {
      if (mode === 'current') $('itemBtn').click();
      else document.querySelector('[data-legacy="ata"]')?.click();
    });
    bindEnter([fields.sipacRequest, fields.sipacYear], () => $('sipacRequestBtn').click());
    bindEnter([fields.sipacCommitment, fields.sipacCommitmentYear], () => $('sipacCommitmentBtn').click());
    bindEnter([fields.sipacContract, fields.sipacContractYear], () => $('sipacContractBtn').click());
    bindEnter([fields.sipacTerm, fields.sipacTermYear], () => $('sipacTermBtn').click());
    bindEnter([fields.sipacGuide, fields.sipacGuideYear], () => $('sipacGuideBtn').click());
    bindEnter([fields.sipacProcessNumber, fields.sipacProcessYear], () => $('sipacProcessPublicBtn').click());
    bindEnter([fields.sipacAsset], () => $('sipacAssetBtn').click());
    bindEnter([fields.transparencyUasg, fields.management, fields.transparencyYear, fields.commitment], () => {
      const record = uasgs.find(unit => unit.c === transparencyUasgCode());
      if (record) applyManagementForUnit(record);
      $('transparencyBtn').click();
    });

    $('purchaseBtn').addEventListener('click', () => {
      if (!requireFourDigitYear(fields.year)) return;
      const info = purchaseInfo();
      openUrl(info.purchaseUrl, `Contratação · ${info.uasg} · ${info.tender}/${info.year}`);
    });
    $('itemBtn').addEventListener('click', () => {
      if (!requireFourDigitYear(fields.year)) return;
      const info = purchaseInfo();
      openUrl(info.itemUrl, `${info.uasg} · PE ${info.tender}/${info.year} · item ${info.item}`);
    });
    $('pncpNoticeBtn').addEventListener('click', validatePncpLink);
    $('noticeBtn').addEventListener('click', downloadCurrentNotice);
    $('pncpAtaBtn').addEventListener('click', validatePncpLink);
    $('srpBtn').addEventListener('click', () => {
      if (!requireFourDigitYear(fields.year)) return;
      const info = purchaseInfo();
      openUrl(srpUrl(info, info.tender), `Itens de ata SRP · ${info.uasg} · ${info.tender}/${info.year}`);
    });

    document.querySelectorAll('[data-legacy]').forEach(button => button.addEventListener('click', () => {
      if (!requireFourDigitYear(fields.year)) return;
      const labels = { ata: 'Ata do pregão', edital: 'Download do edital', srp: 'Itens de ata SRP' };
      const kind = button.dataset.legacy;
      openUrl(legacyUrl(kind), `${labels[kind]} · ${purchaseInfo().uasg}`);
    }));

    $('sipacRequestBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacRequest.value);
      const year = requireFourDigitYear(fields.sipacYear);
      if (!year) return;
      openUrl(number && year ? `https://sipac.ufpb.br/sipac/buscaRequisicao.do?requisicao.numero=${number}&requisicao.ano=${year}` : '', `SIPAC · Requisição ${number}/${year}`, 'sipac');
    });
    $('sipacCommitmentBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacCommitment.value);
      const year = requireFourDigitYear(fields.sipacCommitmentYear);
      if (!year) return;
      openUrl(number && year ? `https://sipac.ufpb.br/sipac/consultaEmpenho.do?numero=${number}&ano=${year}&idUnidadeGestora=605&acao=13` : '', `SIPAC · Empenho ${number}/${year}`, 'sipac');
    });
    $('sipacContractBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacContract.value);
      const year = requireFourDigitYear(fields.sipacContractYear);
      if (!year) return;
      if (!number) {
        fields.sipacContract.focus();
        showToast('Informe o número do contrato.');
        return;
      }
      openSipacContractSearch(number, year);
    });
    $('sipacTermBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacTerm.value);
      const year = requireFourDigitYear(fields.sipacTermYear);
      if (!year) return;
      const url = number
        ? `https://sipac.ufpb.br/sipac/consultarTermoGuia.do?tipoTombamentoTermo=10&popup=true&tipoConsulta=42&numero=${number}&ano=${year}`
        : '';
      openUrl(url, `SIPAC · Termo de responsabilidade ${number}/${year}`, 'sipac');
    });
    $('sipacGuideBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacGuide.value);
      const year = requireFourDigitYear(fields.sipacGuideYear);
      if (!year) return;
      const url = number
        ? `https://sipac.ufpb.br/sipac/consultarTermoGuia.do?tipoConsulta=99&numero=${number}&ano=${year}`
        : '';
      openUrl(url, `SIPAC · Guia de movimentação ${number}/${year}`, 'sipac');
    });
    for (const [id, accessLabel] of [['sipacProcessPublicBtn', 'SIPAC Público'], ['sipacProcessLoggedBtn', 'SIPAC Logado']]) {
      $(id).addEventListener('click', event => {
        const sequence = onlyDigits(fields.sipacProcessNumber.value);
        if (!sequence) {
          event.preventDefault();
          fields.sipacProcessNumber.focus();
          showToast('Informe o número do processo.');
          return;
        }
        if (!requireFourDigitYear(fields.sipacProcessYear)) {
          event.preventDefault();
          return;
        }
        const processNumber = normalizedSipacProcess();
        if (!processNumber) {
          event.preventDefault();
          fields.sipacProcessNumber.focus();
          showToast('Confira o número e o ano do processo.');
          return;
        }
        rememberProcess(processNumber, accessLabel === 'SIPAC Logado' ? 'logged' : 'public', event.currentTarget.href);
      });
    }
    $('sipacAssetBtn').addEventListener('click', event => {
      const tombamento = onlyDigits(fields.sipacAsset.value);
      event.preventDefault();
      if (!tombamento) {
        fields.sipacAsset.focus();
        showToast('Informe o número do tombamento.');
        return;
      }
      openSipacAssetSearch(tombamento);
    });
    $('transparencyBtn').addEventListener('click', () => {
      const uasg = transparencyUasgCode();
      const managementDigits = onlyDigits(fields.management.value);
      const year = requireFourDigitYear(fields.transparencyYear);
      if (!year) return;
      if (uasg.length !== 6) {
        fields.transparencyUasg.focus();
        showToast('Informe uma UASG com 6 dígitos para consultar o empenho.');
        return;
      }
      if (!managementDigits) {
        fields.management.focus();
        showToast('Informe a gestão SIAFI deste órgão.');
        return;
      }
      const management = managementDigits.padStart(5, '0');
      const commitment = onlyDigits(fields.commitment.value).padStart(6, '0');
      const url = commitment
        ? `https://portaldatransparencia.gov.br/despesas/documento/empenho/${uasg}${management}${year}NE${commitment}`
        : '';
      openUrl(url, `Portal da Transparência · ${uasg} · ${year}NE${commitment}`, 'none');
    });
    $('clearRecentBtn').addEventListener('click', () => {
      comprasRecent = [];
      try { localStorage.removeItem(COMPRAS_RECENT_KEY); } catch { /* Sem armazenamento local. */ }
      renderRecent();
    });
    $('clearSipacRecentBtn').addEventListener('click', () => {
      sipacRecent = [];
      try { localStorage.removeItem(SIPAC_RECENT_KEY); } catch { /* Sem armazenamento local. */ }
      renderSipacRecent();
    });
    $('clearProcessRecentBtn').addEventListener('click', () => {
      processRecent = [];
      try { localStorage.removeItem(PROCESS_RECENT_KEY); } catch { /* Sem armazenamento local. */ }
      renderProcessHistory();
      if (favoriteProcesses.length) showToast('Pesquisas recentes limpas; os processos favoritos foram mantidos.');
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
      update();
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
  renderRecent();
  renderSipacRecent();
  renderProcessHistory();
  update();
  loadUasgs();
  recordAnonymousVisit();
  if (installed) $('installLabel').textContent = 'Instalado';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => undefined);
})();
