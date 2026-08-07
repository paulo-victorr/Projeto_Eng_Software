# Estoque Clinico

Sistema web para gestao interna de estoque clinico por lote, criado a partir
dos requisitos do projeto de Engenharia de Software.

## Como abrir

Abra o arquivo `index.html` no navegador.

## Usuarios de teste

- Administrador: `00000000000` / `admin123`
- Servidor de Entrega: `11111111111` / `entrega123`

## Funcionalidades implementadas

- Login com perfis de acesso.
- Dashboard inicial com status por validade e bloqueio.
- Cadastro e edicao de insumos por lote.
- Configuracao de margem de alerta por categoria.
- Registro de baixa com auditoria de usuario, data, destino e justificativa.
- Bloqueio sanitario de lote com impedimento de baixa.
- Validacao de tratamento continuo no momento da entrega.
- Relatorios de estoque e baixas com filtros.
- Exportacao CSV e geracao de PDF pela impressao do navegador.

Os dados ficam salvos no `localStorage` do navegador, adequado para prototipo
academico sem servidor.
