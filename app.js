(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const THIS_YEAR = new Date().getFullYear();
  const FORM_KEY = 'pregao-facil.form';
  const RECENT_KEY = 'pregao-facil.recent';
  const FAVORITES_KEY = 'pregao-facil.favorite-uasgs';
  const UFPB_CNPJ = '24098477000110';
  const SHARED_API_ORIGIN = 'https://pregao-facil-ufpb.lincolnpontes.chatgpt.site';
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
  let recent = readStored(RECENT_KEY, []);
  const storedFavorites = readStored(FAVORITES_KEY, null);
  let favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites : DEFAULT_FAVORITES);
  let installPrompt = null;
  let installed = window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
  let toastTimer = 0;
  const pncpPurchaseCache = new Map();
  try { localStorage.removeItem('pregao-facil.pncp-purchases'); } catch { /* Cache antigo removido quando permitido. */ }

  const fields = {
    uasgInput: $('uasgInput'),
    tender: $('tenderInput'),
    year: $('yearInput'),
    item: $('itemInput'),
    sipacRequest: $('sipacRequestInput'),
    sipacYear: $('sipacYearInput'),
    sipacCommitment: $('sipacCommitmentInput'),
    sipacCommitmentYear: $('sipacCommitmentYearInput'),
    sipacTerm: $('sipacTermInput'),
    sipacTermYear: $('sipacTermYearInput'),
    sipacGuide: $('sipacGuideInput'),
    sipacGuideYear: $('sipacGuideYearInput'),
    management: $('managementInput'),
    transparencyYear: $('transparencyYearInput'),
    commitment: $('commitmentInput')
  };
  const yearFields = [
    fields.year,
    fields.sipacYear,
    fields.sipacCommitmentYear,
    fields.sipacTermYear,
    fields.sipacGuideYear,
    fields.transparencyYear
  ];

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function sharedApiUrl(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return window.location.hostname.endsWith('.chatgpt.site')
      ? normalizedPath
      : `${SHARED_API_ORIGIN}${normalizedPath}`;
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
      sipacTerm: fields.sipacTerm.value,
      sipacTermYear: fields.sipacTermYear.value,
      sipacGuide: fields.sipacGuide.value,
      sipacGuideYear: fields.sipacGuideYear.value,
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

  function remember(label, url) {
    recent = [{ label, url, at: Date.now() }, ...recent.filter(entry => entry.url !== url)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    renderRecent();
  }

  function openUrl(url, label) {
    if (!url) {
      showToast('Confira os campos da consulta.');
      return;
    }
    remember(label, url);
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
    $('transparencyPreview').textContent = `UASG ${info.uasg || '—'} · ${transparencyYear || '—'}NE${onlyDigits(fields.commitment.value).padStart(6, '0')}`;
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
    fields.uasgInput.setAttribute('aria-expanded', 'false');
    update();
  }

  function rankFavorites(records) {
    return records.sort((left, right) =>
      Number(favorites.has(right.c)) - Number(favorites.has(left.c)) ||
      right.a - left.a ||
      left.c.localeCompare(right.c)
    );
  }

  function matchingUasgs() {
    const query = normalizeText(fields.uasgInput.value);
    if (!query || /^\d{6}$/.test(query)) {
      return rankFavorites(uasgs.filter(record => record.a)).slice(0, 10);
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

  function toggleFavorite(record) {
    if (favorites.has(record.c)) favorites.delete(record.c);
    else favorites.add(record.c);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    renderSuggestions();
    showToast(favorites.has(record.c) ? `UASG ${record.c} adicionada aos favoritos.` : `UASG ${record.c} removida dos favoritos.`);
  }

  function renderSuggestions() {
    const box = $('uasgSuggestions');
    box.replaceChildren();
    const matches = matchingUasgs();
    for (const record of matches) {
      const row = document.createElement('div');
      row.className = 'suggestion-row';
      row.role = 'option';
      row.setAttribute('aria-selected', String(record.c === purchaseInfo().uasg));

      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.className = 'suggestion-main';
      selectButton.addEventListener('mousedown', event => event.preventDefault());
      selectButton.addEventListener('click', () => chooseUasg(record));

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
      favoriteButton.addEventListener('click', () => toggleFavorite(record));

      row.append(selectButton, favoriteButton);
      box.append(row);
    }
    box.hidden = matches.length === 0;
    fields.uasgInput.setAttribute('aria-expanded', String(matches.length > 0));
  }

  function renderRecent() {
    const list = $('recentList');
    list.replaceChildren();
    for (const entry of recent) {
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
    remember(label, noticeUrl);
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
    fields.year.value = stored.year || String(THIS_YEAR);
    fields.item.value = stored.item || '1';
    fields.sipacRequest.value = stored.sipacRequest || '6042';
    fields.sipacYear.value = stored.sipacYear || String(THIS_YEAR);
    fields.sipacCommitment.value = stored.sipacCommitment || '801009';
    fields.sipacCommitmentYear.value = stored.sipacCommitmentYear || String(THIS_YEAR);
    fields.sipacTerm.value = stored.sipacTerm || '3069';
    fields.sipacTermYear.value = stored.sipacTermYear || '2025';
    fields.sipacGuide.value = stored.sipacGuide || '2450';
    fields.sipacGuideYear.value = stored.sipacGuideYear || '2025';
    fields.management.value = stored.management || '15231';
    fields.transparencyYear.value = stored.transparencyYear || String(THIS_YEAR);
    fields.commitment.value = stored.commitment || '801009';
    setMode(stored.mode);
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
    Object.values(fields).forEach(input => input.addEventListener('input', update));
    yearFields.forEach(field => field.addEventListener('input', () => {
      field.value = onlyDigits(field.value).slice(0, 4);
      update();
    }));
    fields.item.addEventListener('input', () => { fields.item.value = onlyDigits(fields.item.value).slice(0, 5); update(); });
    fields.management.addEventListener('input', () => { fields.management.value = onlyDigits(fields.management.value).slice(0, 5); update(); });
    fields.commitment.addEventListener('input', () => { fields.commitment.value = onlyDigits(fields.commitment.value).slice(0, 6); update(); });
    fields.uasgInput.addEventListener('focus', renderSuggestions);
    fields.uasgInput.addEventListener('input', renderSuggestions);
    fields.uasgInput.addEventListener('blur', () => window.setTimeout(() => {
      $('uasgSuggestions').hidden = true;
      fields.uasgInput.setAttribute('aria-expanded', 'false');
    }, 140));

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
      openUrl(number && year ? `https://sipac.ufpb.br/sipac/buscaRequisicao.do?requisicao.numero=${number}&requisicao.ano=${year}` : '', `SIPAC · Requisição ${number}/${year}`);
    });
    $('sipacCommitmentBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacCommitment.value);
      const year = requireFourDigitYear(fields.sipacCommitmentYear);
      if (!year) return;
      openUrl(number && year ? `https://sipac.ufpb.br/sipac/consultaEmpenho.do?numero=${number}&ano=${year}&idUnidadeGestora=605&acao=13` : '', `SIPAC · Empenho ${number}/${year}`);
    });
    $('sipacTermBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacTerm.value);
      const year = requireFourDigitYear(fields.sipacTermYear);
      if (!year) return;
      const url = number
        ? `https://sipac.ufpb.br/sipac/consultarTermoGuia.do?tipoTombamentoTermo=10&popup=true&tipoConsulta=42&numero=${number}&ano=${year}`
        : '';
      openUrl(url, `SIPAC · Termo de responsabilidade ${number}/${year}`);
    });
    $('sipacGuideBtn').addEventListener('click', () => {
      const number = onlyDigits(fields.sipacGuide.value);
      const year = requireFourDigitYear(fields.sipacGuideYear);
      if (!year) return;
      const url = number
        ? `https://sipac.ufpb.br/sipac/consultarTermoGuia.do?tipoConsulta=99&numero=${number}&ano=${year}`
        : '';
      openUrl(url, `SIPAC · Guia de movimentação ${number}/${year}`);
    });
    $('transparencyBtn').addEventListener('click', () => {
      const info = purchaseInfo();
      const management = onlyDigits(fields.management.value).padStart(5, '0');
      const year = requireFourDigitYear(fields.transparencyYear);
      if (!year) return;
      const commitment = onlyDigits(fields.commitment.value).padStart(6, '0');
      const url = info.uasg && management && commitment
        ? `https://portaldatransparencia.gov.br/despesas/documento/empenho/${info.uasg}${management}${year}NE${commitment}`
        : '';
      openUrl(url, `Portal da Transparência · ${year}NE${commitment}`);
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
  update();
  loadUasgs();
  if (installed) $('installLabel').textContent = 'Instalado';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => undefined);
})();
