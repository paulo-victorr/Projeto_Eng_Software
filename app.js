const STORAGE_KEY = "estoqueClinicoDados";
const SESSION_KEY = "estoqueClinicoSessao";

const MOVIMENTOS = [
  "Entrega a Paciente",
  "Uso Interno",
  "Descarte por Vencimento",
  "Avaria/Quebra",
  "Perda/Furto"
];

const PERFIS = {
  admin: "Administrador",
  entrega: "Servidor de Entrega"
};

const state = {
  dados: null,
  usuario: null,
  tela: "dashboard",
  filtros: {
    busca: "",
    categoria: "",
    fornecedor: "",
    status: "",
    periodoInicio: "",
    periodoFim: ""
  }
};

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefixo) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function hashSenha(senha) {
  const bytes = new TextEncoder().encode(senha);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function diasEntre(dataFinal, dataInicial = hojeIso()) {
  const inicio = new Date(`${dataInicial}T00:00:00`);
  const fim = new Date(`${dataFinal}T00:00:00`);
  return Math.ceil((fim - inicio) / 86400000);
}

function formatarData(data) {
  if (!data) return "-";
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function dadosIniciais() {
  return {
    usuarios: [
      {
        id: "u-admin",
        nome: "Administrador da Unidade",
        cpf: "00000000000",
        perfil: "admin",
        senhaHash: await hashSenha("admin123")
      },
      {
        id: "u-entrega",
        nome: "Servidor de Entrega",
        cpf: "11111111111",
        perfil: "entrega",
        senhaHash: await hashSenha("entrega123")
      }
    ],
    configuracoes: {
      emails: "farmacia@clinica.local",
      frequenciaAlertas: "Diaria",
      margens: {
        "Anestesico": 30,
        "Resina": 45,
        "Descartaveis": 60,
        "Medicamento de uso continuo": 90,
        "EPI": 60,
        "Reagente laboratorial": 30
      }
    },
    lotes: [
      {
        id: "lote-1",
        nome: "Lidocaina 2%",
        fabricante: "Saude Farma",
        categoria: "Anestesico",
        lote: "LD-2026-071",
        quantidade: 42,
        unidade: "ampola",
        fabricacao: "2025-11-10",
        validade: "2026-08-12",
        fornecedor: "CAF Municipal",
        entrada: "2026-01-18",
        bloqueado: false,
        motivoBloqueio: ""
      },
      {
        id: "lote-2",
        nome: "Seringa descartavel 5 ml",
        fabricante: "MedSupply",
        categoria: "Descartaveis",
        lote: "SR-0442",
        quantidade: 260,
        unidade: "unidade",
        fabricacao: "2024-04-02",
        validade: "2026-07-02",
        fornecedor: "Almoxarifado Central",
        entrada: "2026-02-04",
        bloqueado: false,
        motivoBloqueio: ""
      },
      {
        id: "lote-3",
        nome: "Amoxicilina 500 mg",
        fabricante: "BioClin",
        categoria: "Medicamento de uso continuo",
        lote: "AMX-9001",
        quantidade: 90,
        unidade: "comprimido",
        fabricacao: "2025-08-15",
        validade: "2026-11-20",
        fornecedor: "CAF Municipal",
        entrada: "2026-03-11",
        bloqueado: true,
        motivoBloqueio: "Recall preventivo do fornecedor"
      }
    ],
    baixas: [],
    auditoria: []
  };
}

function salvar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.dados));
}

function registrarAuditoria(acao, detalhes) {
  state.dados.auditoria.unshift({
    id: uid("aud"),
    dataHora: new Date().toISOString(),
    usuario: state.usuario?.nome || "Sistema",
    acao,
    detalhes
  });
  salvar();
}

function podeAdministrar() {
  return state.usuario?.perfil === "admin";
}

function margemCategoria(categoria) {
  return Number(state.dados.configuracoes.margens[categoria] ?? 30);
}

function statusLote(lote) {
  if (lote.bloqueado) {
    return {
      chave: "bloqueado",
      rotulo: "Bloqueado",
      classe: "bg-blocked",
      texto: "blocked-text"
    };
  }

  const dias = diasEntre(lote.validade);
  if (dias < 0) {
    return {
      chave: "vencido",
      rotulo: "Vencido",
      classe: "bg-danger",
      texto: "danger-text"
    };
  }

  if (dias <= margemCategoria(lote.categoria)) {
    return {
      chave: "alerta",
      rotulo: "Em alerta",
      classe: "bg-warning",
      texto: "warning"
    };
  }

  return {
    chave: "normal",
    rotulo: "Normal",
    classe: "bg-ok",
    texto: "ok"
  };
}

function lotesFiltrados() {
  return state.dados.lotes.filter((lote) => {
    const status = statusLote(lote).chave;
    const texto = `${lote.nome} ${lote.fabricante} ${lote.lote}`.toLowerCase();
    return (!state.filtros.busca || texto.includes(state.filtros.busca.toLowerCase()))
      && (!state.filtros.categoria || lote.categoria === state.filtros.categoria)
      && (!state.filtros.fornecedor || lote.fornecedor === state.filtros.fornecedor)
      && (!state.filtros.status || status === state.filtros.status);
  });
}

function categorias() {
  return Array.from(new Set([
    ...Object.keys(state.dados.configuracoes.margens),
    ...state.dados.lotes.map((lote) => lote.categoria)
  ])).sort();
}

function fornecedores() {
  return Array.from(new Set(state.dados.lotes.map((lote) => lote.fornecedor))).sort();
}

function opcoes(lista, selecionado = "") {
  return lista.map((item) => (
    `<option value="${escapar(item)}"${item === selecionado ? " selected" : ""}>${escapar(item)}</option>`
  )).join("");
}

function metricas() {
  return state.dados.lotes.reduce((acc, lote) => {
    acc.total += 1;
    acc[statusLote(lote).chave] += 1;
    return acc;
  }, { total: 0, normal: 0, alerta: 0, vencido: 0, bloqueado: 0 });
}

function shell(conteudo) {
  const nav = [
    ["dashboard", "Painel"],
    ["estoque", "Estoque"],
    ["baixa", "Baixa"],
    ["relatorios", "Relatorios"],
    ["config", "Configuracoes"]
  ];

  const itensNav = nav
    .filter(([tela]) => tela !== "config" || podeAdministrar())
    .map(([tela, nome]) => (
      `<button class="${state.tela === tela ? "active" : ""}" data-nav="${tela}">${nome}</button>`
    )).join("");

  return `
    <section class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">EC</div>
          <div>
            <strong>Estoque Clinico</strong>
            <span>Controle de lotes</span>
          </div>
        </div>
        <nav class="nav">${itensNav}</nav>
        <div class="user-box">
          <strong>${escapar(state.usuario.nome)}</strong>
          <span>${PERFIS[state.usuario.perfil]}</span>
          <button class="secondary" id="sair">Sair</button>
        </div>
      </aside>
      <section class="content">${conteudo}</section>
    </section>
  `;
}

function topbar(titulo, subtitulo, acao = "") {
  return `
    <header class="topbar">
      <div>
        <h1>${titulo}</h1>
        <p>${subtitulo}</p>
      </div>
      <div class="actions">${acao}</div>
    </header>
  `;
}

function renderLogin() {
  document.querySelector("#app").innerHTML = `
    <section class="login-page">
      <div class="login-visual">
        <div>
          <h1>Estoque Clinico</h1>
          <p>Gestao interna de lotes, validades, consumo e bloqueios sanitarios.</p>
        </div>
      </div>
      <div class="login-panel">
        <form class="login-card" id="loginForm">
          <h2>Acesso ao sistema</h2>
          <label>CPF
            <input name="cpf" inputmode="numeric" autocomplete="username" required>
          </label>
          <label>Senha
            <input name="senha" type="password" autocomplete="current-password" required>
          </label>
          <button type="submit">Entrar</button>
          <div class="demo-access">
            <strong>Usuarios de teste</strong><br>
            Administrador: 00000000000 / admin123<br>
            Entrega: 11111111111 / entrega123
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderDashboard() {
  const m = metricas();
  const criticos = state.dados.lotes
    .filter((lote) => ["alerta", "vencido", "bloqueado"].includes(statusLote(lote).chave))
    .sort((a, b) => diasEntre(a.validade) - diasEntre(b.validade));

  const conteudo = `
    ${topbar("Painel de alertas", "Situacao atual do estoque por validade e bloqueio sanitario.")}
    <section class="grid metrics">
      <article class="metric"><div class="status-strip bg-ok"></div><span>Dentro da validade</span><strong>${m.normal}</strong></article>
      <article class="metric"><div class="status-strip bg-warning"></div><span>Proximos do vencimento</span><strong>${m.alerta}</strong></article>
      <article class="metric"><div class="status-strip bg-danger"></div><span>Vencidos</span><strong>${m.vencido}</strong></article>
      <article class="metric"><div class="status-strip bg-blocked"></div><span>Bloqueados</span><strong>${m.bloqueado}</strong></article>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Lotes que exigem atencao</h2>
      <p class="panel-description">Esta lista exibe apenas lotes em alerta, vencidos ou bloqueados. Lotes liberados e dentro da validade continuam no estoque e são contabilizados no indicador acima.</p>
      ${tabelaLotes(criticos)}
    </section>
  `;

  document.querySelector("#app").innerHTML = shell(conteudo);
}

function filtrosEstoque() {
  return `
    <section class="panel">
      <div class="filters">
        <label>Busca
          <input id="busca" value="${escapar(state.filtros.busca)}" placeholder="Produto, fabricante ou lote">
        </label>
        <label>Categoria
          <select id="categoriaFiltro">
            <option value="">Todas</option>${opcoes(categorias(), state.filtros.categoria)}
          </select>
        </label>
        <label>Fornecedor
          <select id="fornecedorFiltro">
            <option value="">Todos</option>${opcoes(fornecedores(), state.filtros.fornecedor)}
          </select>
        </label>
        <label>Status
          <select id="statusFiltro">
            <option value="">Todos</option>
            <option value="normal"${state.filtros.status === "normal" ? " selected" : ""}>Normal</option>
            <option value="alerta"${state.filtros.status === "alerta" ? " selected" : ""}>Em alerta</option>
            <option value="vencido"${state.filtros.status === "vencido" ? " selected" : ""}>Vencido</option>
            <option value="bloqueado"${state.filtros.status === "bloqueado" ? " selected" : ""}>Bloqueado</option>
          </select>
        </label>
      </div>
      <div id="resultadoLotes">${tabelaLotes(lotesFiltrados())}</div>
    </section>
  `;
}

function renderEstoque() {
  const acao = podeAdministrar()
    ? `<button id="novoLote">Novo lote</button>`
    : "";

  document.querySelector("#app").innerHTML = shell(`
    ${topbar("Estoque por lote", "Cadastro, consulta e situacao dos produtos armazenados.", acao)}
    ${filtrosEstoque()}
  `);
}

function tabelaLotes(lotes) {
  if (!lotes.length) {
    return `<div class="empty">Nenhum lote encontrado.</div>`;
  }

  const linhas = lotes.map((lote) => {
    const st = statusLote(lote);
    const dias = diasEntre(lote.validade);
    const acoes = podeAdministrar()
      ? `<button class="ghost" data-editar="${lote.id}">Editar</button>
         <button class="ghost" data-recall="${lote.id}">${lote.bloqueado ? "Liberar" : "Bloquear"}</button>`
      : "";

    return `
      <tr>
        <td><strong>${escapar(lote.nome)}</strong><br>${escapar(lote.fabricante)}</td>
        <td>${escapar(lote.categoria)}</td>
        <td>${escapar(lote.lote)}</td>
        <td>${lote.quantidade} ${escapar(lote.unidade)}</td>
        <td>${formatarData(lote.validade)}<br><span class="${st.texto}">${dias} dias</span></td>
        <td><span class="badge ${st.classe}">${st.rotulo}</span></td>
        <td>${escapar(lote.fornecedor)}</td>
        <td class="actions">${acoes}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Lote</th>
            <th>Saldo</th>
            <th>Validade</th>
            <th>Status</th>
            <th>Fornecedor</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  `;
}

function renderBaixa() {
  const lotesDisponiveis = state.dados.lotes
    .filter((lote) => lote.quantidade > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  document.querySelector("#app").innerHTML = shell(`
    ${topbar("Registro de baixa", "Saida de estoque com validacao de saldo, bloqueio e tratamento continuo.")}
    <section class="panel">
      <form id="baixaForm" class="form-grid">
        <label class="wide">Lote
          <select name="loteId" required>
            <option value="">Selecione</option>
            ${lotesDisponiveis.map((lote) => (
              `<option value="${lote.id}">${escapar(lote.nome)} - ${escapar(lote.lote)} (${lote.quantidade} ${escapar(lote.unidade)})</option>`
            )).join("")}
          </select>
        </label>
        <label>Quantidade
          <input name="quantidade" type="number" min="1" required>
        </label>
        <label>Movimentacao
          <select name="categoriaMovimento" required>${opcoes(MOVIMENTOS)}</select>
        </label>
        <label>Dias de tratamento
          <input name="diasTratamento" type="number" min="0" value="0">
        </label>
        <label class="wide">Paciente ou destino
          <input name="destino" required>
        </label>
        <label class="wide">Justificativa
          <textarea name="justificativa" required></textarea>
        </label>
        <div class="actions wide">
          <button type="submit">Confirmar baixa</button>
        </div>
      </form>
    </section>
  `);
}

function renderRelatorios() {
  const baixas = baixasFiltradas();
  document.querySelector("#app").innerHTML = shell(`
    ${topbar("Relatorios gerenciais", "Estoque, distribuicao e trilha de auditoria.", `
      <button id="exportarEstoque">Exportar estoque CSV</button>
      <button id="exportarBaixas" class="secondary">Exportar baixas CSV</button>
      <button id="imprimir" class="secondary">Gerar PDF</button>
    `)}
    <section class="panel">
      <h2>Filtros de distribuicao</h2>
      <div class="filters">
        <label>Inicio
          <input id="periodoInicio" type="date" value="${state.filtros.periodoInicio}">
        </label>
        <label>Fim
          <input id="periodoFim" type="date" value="${state.filtros.periodoFim}">
        </label>
        <label>Categoria
          <select id="categoriaFiltro">
            <option value="">Todas</option>${opcoes(categorias(), state.filtros.categoria)}
          </select>
        </label>
        <label>Lote
          <input id="busca" value="${escapar(state.filtros.busca)}" placeholder="Numero do lote">
        </label>
      </div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Estoque atual</h2>
      <div id="resultadoEstoque">${tabelaLotes(lotesFiltrados())}</div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Historico de baixas</h2>
      <div id="resultadoBaixas">${tabelaBaixas(baixas)}</div>
    </section>
  `);
}

function baixasFiltradas() {
  return state.dados.baixas.filter((baixa) => {
    const lote = state.dados.lotes.find((item) => item.id === baixa.loteId);
    const data = baixa.dataHora.slice(0, 10);
    return (!state.filtros.periodoInicio || data >= state.filtros.periodoInicio)
      && (!state.filtros.periodoFim || data <= state.filtros.periodoFim)
      && (!state.filtros.categoria || lote?.categoria === state.filtros.categoria)
      && (!state.filtros.busca || lote?.lote.toLowerCase().includes(state.filtros.busca.toLowerCase()));
  });
}

function tabelaBaixas(baixas) {
  if (!baixas.length) {
    return `<div class="empty">Nenhuma baixa registrada.</div>`;
  }

  const linhas = baixas.map((baixa) => {
    const lote = state.dados.lotes.find((item) => item.id === baixa.loteId);
    return `
      <tr>
        <td>${new Date(baixa.dataHora).toLocaleString("pt-BR")}</td>
        <td><strong>${escapar(lote?.nome || "Lote removido")}</strong><br>${escapar(lote?.lote || "-")}</td>
        <td>${baixa.quantidade}</td>
        <td>${escapar(baixa.categoriaMovimento)}</td>
        <td>${escapar(baixa.usuario)}</td>
        <td>${escapar(baixa.destino)}<br>${escapar(baixa.justificativa)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Lote</th>
            <th>Qtd.</th>
            <th>Movimento</th>
            <th>Responsavel</th>
            <th>Destino / Justificativa</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  `;
}

function renderConfig() {
  const linhas = categorias().map((categoria) => `
    <label>${escapar(categoria)}
      <input data-margem="${escapar(categoria)}" type="number" min="1" value="${margemCategoria(categoria)}">
    </label>
  `).join("");

  document.querySelector("#app").innerHTML = shell(`
    ${topbar("Configuracoes", "Margens de alerta, destinatarios e frequencia de notificacao.")}
    <section class="panel">
      <form id="configForm" class="form-grid">
        ${linhas}
        <label class="wide">E-mails institucionais
          <input name="emails" value="${escapar(state.dados.configuracoes.emails)}">
        </label>
        <label>Frequencia de reenvio
          <select name="frequenciaAlertas">
            <option${state.dados.configuracoes.frequenciaAlertas === "Diaria" ? " selected" : ""}>Diaria</option>
            <option${state.dados.configuracoes.frequenciaAlertas === "Semanal" ? " selected" : ""}>Semanal</option>
          </select>
        </label>
        <div class="actions wide">
          <button type="submit">Salvar configuracoes</button>
        </div>
      </form>
    </section>
  `);
}

function modalLote(lote = null) {
  const item = lote || {
    nome: "",
    fabricante: "",
    categoria: "Anestesico",
    lote: "",
    quantidade: "",
    unidade: "unidade",
    fabricacao: "",
    validade: "",
    fornecedor: "",
    entrada: hojeIso()
  };

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="modal">
      <section class="modal">
        <header>
          <h2>${lote ? "Editar lote" : "Novo lote"}</h2>
          <button class="secondary" id="fecharModal" type="button">Fechar</button>
        </header>
        <form id="loteForm" class="form-grid">
          <input type="hidden" name="id" value="${escapar(lote?.id || "")}">
          <label class="wide">Nome do produto
            <input name="nome" value="${escapar(item.nome)}" required>
          </label>
          <label>Fabricante
            <input name="fabricante" value="${escapar(item.fabricante)}" required>
          </label>
          <label>Categoria
            <input name="categoria" list="categorias" value="${escapar(item.categoria)}" required>
            <datalist id="categorias">${opcoes(categorias())}</datalist>
          </label>
          <label>Numero do lote
            <input name="lote" value="${escapar(item.lote)}" required>
          </label>
          <label>Quantidade
            <input name="quantidade" type="number" min="0" value="${escapar(item.quantidade)}" required>
          </label>
          <label>Unidade
            <input name="unidade" value="${escapar(item.unidade)}" required>
          </label>
          <label>Fabricacao
            <input name="fabricacao" type="date" value="${escapar(item.fabricacao)}" required>
          </label>
          <label>Validade
            <input name="validade" type="date" value="${escapar(item.validade)}" required>
          </label>
          <label>Fornecedor
            <input name="fornecedor" value="${escapar(item.fornecedor)}" required>
          </label>
          <label>Entrada
            <input name="entrada" type="date" value="${escapar(item.entrada)}" required>
          </label>
          <div class="actions wide">
            <button type="submit">Salvar lote</button>
          </div>
        </form>
      </section>
    </div>
  `);
  vincularEventosModal();
}

function abrirRecall(loteId) {
  const lote = state.dados.lotes.find((item) => item.id === loteId);
  if (!lote) return;

  if (lote.bloqueado) {
    lote.bloqueado = false;
    lote.motivoBloqueio = "";
    registrarAuditoria("Liberacao sanitaria", `${lote.nome} - ${lote.lote}`);
    toast("Lote liberado para movimentacao.");
    render();
    return;
  }

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="modal">
      <section class="modal">
        <header>
          <h2>Bloqueio sanitario</h2>
          <button class="secondary" id="fecharModal" type="button">Fechar</button>
        </header>
        <form id="recallForm" class="form-grid">
          <input type="hidden" name="id" value="${lote.id}">
          <label class="wide">Motivo
            <textarea name="motivo" required></textarea>
          </label>
          <div class="actions wide">
            <button class="danger" type="submit">Bloquear lote</button>
          </div>
        </form>
      </section>
    </div>
  `);
  vincularEventosModal();
}

function fecharModal() {
  const modal = document.querySelector("#modal");
  if (!modal) return;
  modal.dispatchEvent(new Event("modal:fechar"));
  modal.remove();
}

function vincularEventosModal() {
  const modal = document.querySelector("#modal");
  if (!modal) return;

  modal.querySelector("#fecharModal")?.addEventListener("click", fecharModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) fecharModal();
  });

  modal.querySelector("#loteForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    salvarLote(event.currentTarget);
  });

  modal.querySelector("#recallForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const loteId = form.querySelector('[name="id"]').value;
    const lote = state.dados.lotes.find((item) => item.id === loteId);
    if (!lote) {
      toast("Lote nao encontrado.");
      fecharModal();
      return;
    }

    lote.bloqueado = true;
    lote.motivoBloqueio = form.motivo.value.trim();
    registrarAuditoria("Bloqueio sanitario", `${lote.nome} - ${lote.lote}: ${lote.motivoBloqueio}`);
    fecharModal();
    toast("Lote bloqueado imediatamente.");
    render();
  });

  const fecharComEsc = (event) => {
    if (event.key === "Escape" && document.querySelector("#modal") === modal) {
      fecharModal();
    }
  };
  document.addEventListener("keydown", fecharComEsc);
  modal.addEventListener("modal:fechar", () => {
    document.removeEventListener("keydown", fecharComEsc);
  }, { once: true });
}

function toast(mensagem) {
  document.querySelector(".toast")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="toast">${escapar(mensagem)}</div>`);
  setTimeout(() => document.querySelector(".toast")?.remove(), 3600);
}

function validarLoteForm(form) {
  const entrada = form.entrada.value;
  const validade = form.validade.value;
  if (validade < entrada) {
    return "A validade nao pode ser anterior a data de entrada.";
  }
  return "";
}

function salvarLote(form) {
  const erro = validarLoteForm(form);
  if (erro) {
    toast(erro);
    return;
  }

  const loteId = form.querySelector('[name="id"]').value;
  const loteExistente = state.dados.lotes.find((item) => item.id === loteId);
  const lote = {
    id: loteId || uid("lote"),
    nome: form.nome.value.trim(),
    fabricante: form.fabricante.value.trim(),
    categoria: form.categoria.value.trim(),
    lote: form.lote.value.trim(),
    quantidade: Number(form.quantidade.value),
    unidade: form.unidade.value.trim(),
    fabricacao: form.fabricacao.value,
    validade: form.validade.value,
    fornecedor: form.fornecedor.value.trim(),
    entrada: form.entrada.value,
    bloqueado: loteExistente?.bloqueado || false,
    motivoBloqueio: loteExistente?.motivoBloqueio || ""
  };

  if (!state.dados.configuracoes.margens[lote.categoria]) {
    state.dados.configuracoes.margens[lote.categoria] = 30;
  }

  const index = state.dados.lotes.findIndex((item) => item.id === lote.id);
  if (index >= 0) {
    state.dados.lotes[index] = lote;
    registrarAuditoria("Edicao de lote", `${lote.nome} - ${lote.lote}`);
  } else {
    state.dados.lotes.unshift(lote);
    registrarAuditoria("Cadastro de lote", `${lote.nome} - ${lote.lote}`);
  }

  fecharModal();
  toast("Lote salvo.");
  render();
}

function confirmarBaixa(form) {
  const lote = state.dados.lotes.find((item) => item.id === form.loteId.value);
  const quantidade = Number(form.quantidade.value);
  const diasTratamento = Number(form.diasTratamento.value || 0);

  if (!lote) {
    toast("Selecione um lote.");
    return;
  }

  if (lote.bloqueado) {
    toast("Baixa bloqueada: lote suspenso ou contaminado.");
    return;
  }

  if (quantidade <= 0 || quantidade > lote.quantidade) {
    toast("Saldo insuficiente para confirmar a baixa.");
    return;
  }

  if (
    lote.categoria === "Medicamento de uso continuo"
    && form.categoriaMovimento.value === "Entrega a Paciente"
    && diasEntre(lote.validade) < diasTratamento
  ) {
    toast("Baixa bloqueada: validade inferior a duracao total do tratamento.");
    return;
  }

  lote.quantidade -= quantidade;
  const baixa = {
    id: uid("baixa"),
    loteId: lote.id,
    quantidade,
    usuario: state.usuario.nome,
    dataHora: new Date().toISOString(),
    categoriaMovimento: form.categoriaMovimento.value,
    destino: form.destino.value.trim(),
    justificativa: form.justificativa.value.trim(),
    diasTratamento
  };
  state.dados.baixas.unshift(baixa);
  registrarAuditoria("Baixa de estoque", `${lote.nome} - ${lote.lote}: ${quantidade}`);
  toast("Baixa registrada.");
  render();
}

function exportarCsv(nome, linhas) {
  const conteudo = linhas
    .map((linha) => linha.map((campo) => `"${String(campo ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEstoque() {
  const cabecalho = ["Produto", "Fabricante", "Categoria", "Lote", "Quantidade", "Unidade", "Validade", "Status", "Fornecedor"];
  const linhas = lotesFiltrados().map((lote) => [
    lote.nome,
    lote.fabricante,
    lote.categoria,
    lote.lote,
    lote.quantidade,
    lote.unidade,
    lote.validade,
    statusLote(lote).rotulo,
    lote.fornecedor
  ]);
  exportarCsv("relatorio-estoque.csv", [cabecalho, ...linhas]);
}

function csvBaixas() {
  const cabecalho = ["Data", "Produto", "Lote", "Quantidade", "Movimento", "Responsavel", "Destino", "Justificativa"];
  const linhas = baixasFiltradas().map((baixa) => {
    const lote = state.dados.lotes.find((item) => item.id === baixa.loteId);
    return [
      baixa.dataHora,
      lote?.nome || "",
      lote?.lote || "",
      baixa.quantidade,
      baixa.categoriaMovimento,
      baixa.usuario,
      baixa.destino,
      baixa.justificativa
    ];
  });
  exportarCsv("relatorio-baixas.csv", [cabecalho, ...linhas]);
}

function vincularEventos() {
  document.querySelectorAll("[data-nav]").forEach((botao) => {
    botao.addEventListener("click", () => {
      state.tela = botao.dataset.nav;
      render();
    });
  });

  document.querySelector("#sair")?.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    state.usuario = null;
    render();
  });

  document.querySelector("#loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const senhaHash = await hashSenha(form.senha.value);
    const usuario = state.dados.usuarios.find((item) => (
      item.cpf === form.cpf.value.trim() && item.senhaHash === senhaHash
    ));

    if (!usuario) {
      toast("CPF ou senha invalidos.");
      return;
    }

    state.usuario = usuario;
    state.tela = "dashboard";
    sessionStorage.setItem(SESSION_KEY, usuario.id);
    registrarAuditoria("Login", usuario.nome);
    render();
  });

  document.querySelector("#novoLote")?.addEventListener("click", () => modalLote());
  vincularAcoesLotes();

  document.querySelector("#baixaForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmarBaixa(event.currentTarget);
  });

  document.querySelector("#configForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    form.querySelectorAll("[data-margem]").forEach((input) => {
      state.dados.configuracoes.margens[input.dataset.margem] = Number(input.value);
    });
    state.dados.configuracoes.emails = form.emails.value.trim();
    state.dados.configuracoes.frequenciaAlertas = form.frequenciaAlertas.value;
    registrarAuditoria("Configuracao de alertas", "Margens e destinatarios atualizados");
    toast("Configuracoes salvas.");
    render();
  });

  ["busca", "categoriaFiltro", "fornecedorFiltro", "statusFiltro", "periodoInicio", "periodoFim"]
    .forEach((id) => {
      document.querySelector(`#${id}`)?.addEventListener("input", (event) => {
        const mapa = {
          busca: "busca",
          categoriaFiltro: "categoria",
          fornecedorFiltro: "fornecedor",
          statusFiltro: "status",
          periodoInicio: "periodoInicio",
          periodoFim: "periodoFim"
        };
        state.filtros[mapa[id]] = event.target.value;
        atualizarResultadosFiltrados();
      });
    });

  document.querySelector("#exportarEstoque")?.addEventListener("click", csvEstoque);
  document.querySelector("#exportarBaixas")?.addEventListener("click", csvBaixas);
  document.querySelector("#imprimir")?.addEventListener("click", () => window.print());
}

function vincularAcoesLotes() {
  document.querySelectorAll("[data-editar]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const lote = state.dados.lotes.find((item) => item.id === botao.dataset.editar);
      if (lote) modalLote(lote);
    });
  });

  document.querySelectorAll("[data-recall]").forEach((botao) => {
    botao.addEventListener("click", () => abrirRecall(botao.dataset.recall));
  });
}

function atualizarResultadosFiltrados() {
  const resultadoLotes = document.querySelector("#resultadoLotes");
  if (resultadoLotes) {
    resultadoLotes.innerHTML = tabelaLotes(lotesFiltrados());
    vincularAcoesLotes();
  }

  const resultadoEstoque = document.querySelector("#resultadoEstoque");
  if (resultadoEstoque) {
    resultadoEstoque.innerHTML = tabelaLotes(lotesFiltrados());
    vincularAcoesLotes();
  }

  const resultadoBaixas = document.querySelector("#resultadoBaixas");
  if (resultadoBaixas) {
    resultadoBaixas.innerHTML = tabelaBaixas(baixasFiltradas());
  }
}

function render() {
  if (!state.usuario) {
    renderLogin();
    vincularEventos();
    return;
  }

  if (state.tela === "dashboard") renderDashboard();
  if (state.tela === "estoque") renderEstoque();
  if (state.tela === "baixa") renderBaixa();
  if (state.tela === "relatorios") renderRelatorios();
  if (state.tela === "config") renderConfig();
  vincularEventos();
}

async function iniciar() {
  const salvo = localStorage.getItem(STORAGE_KEY);
  state.dados = salvo ? JSON.parse(salvo) : await dadosIniciais();
  salvar();

  const usuarioId = sessionStorage.getItem(SESSION_KEY);
  state.usuario = state.dados.usuarios.find((usuario) => usuario.id === usuarioId) || null;
  render();
}

iniciar();
