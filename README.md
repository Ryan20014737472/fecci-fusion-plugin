# FECCI Fusion 360 — servidor MCP

Primeira versão do servidor MCP para o plugin **FECCI Fusion 360** do ChatGPT.
Disponibiliza informações públicas do [Projeto FECCI](https://ryan20014737472.github.io/Fecci-fusion-360/)
sobre Autodesk Fusion 360, modelagem e prototipagem 3D, educação, Cultura Maker e STEAM.

Implementado em JavaScript com Node.js, Express e o SDK oficial
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk).
O transporte é **Streamable HTTP**, no endpoint **`/mcp`**. Esta versão não inclui
autenticação nem interface gráfica.

## Instalação

Requisitos: Node.js **22 ou superior** e npm. O `package-lock.json` fixa as versões
das dependências usadas nos testes.

```bash
git clone https://github.com/Ryan20014737472/fecci-fusion-plugin.git
cd fecci-fusion-plugin
npm ci
```

## Execução

```bash
npm start
```

Endereço padrão: **`http://127.0.0.1:3000/mcp`**.
O terminal imprime esse endereço quando o servidor está pronto.
Para desenvolvimento com reinicialização automática:

```bash
npm run dev
```

As configurações são lidas das variáveis de ambiente:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta inteira entre 1 e 65535. |
| `HOST` | `127.0.0.1` | Interface de escuta. |
| `ALLOWED_HOSTS` | Hosts locais | Nomes/IPs exatos aceitos no cabeçalho `Host`, separados por vírgulas, sem esquema, porta ou caminho. Para IPv6, use colchetes, como `[::1]`. Obrigatória quando `HOST` é `0.0.0.0` ou `::`. |
| `ALLOWED_ORIGINS` | Nenhuma | Origens exatas autorizadas, como `http://localhost:6274`, separadas por vírgulas. Requisições sem `Origin` são aceitas; um `Origin` não autorizado recebe HTTP 403. |

Exemplo com outra porta:

```bash
PORT=8080 npm start
```

Opcionalmente, copie `.env.example` para `.env` e execute:

```bash
node --env-file=.env server.js
```

`npm start` não carrega `.env` automaticamente. Não há autenticação; a validação
de `Host` e `Origin` apenas limita os cabeçalhos aceitos pelo endpoint.
Porta inválida, configuração inválida e falhas de escuta, como porta ocupada,
geram uma mensagem no terminal e encerramento com código diferente de zero.
`Ctrl+C` e `SIGTERM` encerram o servidor e suas conexões.

## Ferramenta disponível

**`get_project_info`** não recebe argumentos (`{}`) e é somente leitura.
Declara `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`
e `openWorldHint: false`, pois consulta um arquivo local verificado.

A resposta contém `structuredContent`, validado por um `outputSchema` Zod, e
uma representação do mesmo JSON em `content` para clientes que leem texto.

| Campo | Conteúdo |
| --- | --- |
| `name` | Nome público: Projeto FECCI. |
| `title` | Título completo exibido no site. |
| `description` | Resumo baseado nas seções Sobre o projeto e Artigo do projeto. |
| `areas` | Temas abordados no site. |
| `official_site_url` | URL oficial do projeto. |
| `public_information` | Edição, contexto, objetivo, minicurso, material de apoio e estágio dos resultados. |
| `source_checked_at` | Data em que o site foi verificado. |
| `sources` | Seções e URLs usadas como fontes. |

O nome **FECCI Fusion 360** identifica o servidor/plugin; **Projeto FECCI** é o
nome apresentado no site. Não foi atribuída uma expansão à sigla FECCI.

### Origem e atualização dos dados

`data/project-info.json` é um **retrato do site público verificado em 2026-10-03**.
O servidor não acessa a internet a cada chamada e não afirma que os dados são
atualizados em tempo real.

As fontes do retrato são:

| Informação | Seção do site |
| --- | --- |
| Nome, título e edição | Início e rodapé. |
| Descrição e objetivo | `#projeto` e `#artigo-fecci`. |
| Áreas abordadas e visualização espacial | `#projeto`, `#fundamentacao` e `#minicurso`. |
| Contexto educacional | `#artigo-fecci` e rodapé. |
| Duração de 90 minutos, público de 15 a 18 anos e atividade prática | `#minicurso`. |
| Guia de apoio e link público do PDF | `#material`. |
| Capacitação-piloto concluída e indicadores quantitativos ainda pendentes | `#resultados`. |
| Próxima etapa de aplicação e avaliação | `#diario`. |

O retrato mantém a distinção publicada no site entre a capacitação-piloto já
realizada e a futura aplicação às turmas com análise dos questionários. Não
apresenta resultados esperados nem resultados de artigos de terceiros como
resultados medidos do projeto.

Para atualizar o conteúdo, confira novamente as seções do site, edite apenas
os fatos confirmados em `data/project-info.json`, atualize `source_checked_at`
e as fontes correspondentes e execute `npm test`. O arquivo é lido e validado
em cada chamada; alterações válidas ficam disponíveis sem reiniciar o servidor.

## Testar o endpoint MCP

Mantenha `npm start` executando e use outro terminal para os comandos abaixo.
O endpoint segue JSON-RPC 2.0; abrir `/mcp` no navegador gera HTTP **405**, pois
esta versão aceita apenas **POST**.

### 1. Inicializar o cliente

```bash
curl -i http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fecci-teste","version":"1.0.0"}}}'
```

Resultado esperado: HTTP **200**, versão do protocolo negociada e
`serverInfo.title` igual a `FECCI Fusion 360`.

### 2. Enviar a notificação de inicialização

```bash
curl -i http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
```

Resultado esperado: HTTP **202**, sem corpo.

### 3. Listar ferramentas

```bash
curl -sS http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Resultado esperado: somente `get_project_info`, com os esquemas de entrada,
saída e as anotações de leitura.

### 4. Consultar o projeto

```bash
curl -sS http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_project_info","arguments":{}}}'
```

Resultado esperado: `result.structuredContent` com os dados públicos, a data
de verificação e as fontes, além de `result.content` com o mesmo JSON em texto.
Clientes que negociam outra versão suportada devem enviar a versão recebida
em `initialize` no cabeçalho `MCP-Protocol-Version` das próximas requisições.

### Testes automatizados

```bash
npm run check
npm test
```

Os testes usam `node:test` e o cliente oficial do SDK em portas locais temporárias.
Verificam inicialização, descoberta e chamada da ferramenta, conteúdo estruturado,
chamadas concorrentes, notificações, erros de JSON, limite de corpo, validação
de argumentos, métodos HTTP, `Host`/`Origin`, falha na leitura e configuração.
Não precisam do site disponível nem de credenciais.

## Estrutura do projeto

```text
.
├── server.js                    # Inicialização HTTP e encerramento por sinal
├── package.json                 # Dependências, versão, scripts e requisito de Node
├── package-lock.json            # Versões resolvidas das dependências
├── .env.example                 # Exemplo de configuração opcional
├── .gitignore                   # Exclusões de dependências e arquivos locais
├── data/
│   └── project-info.json         # Fatos públicos com fontes e data de consulta
├── src/
│   ├── app.js                   # /mcp, transporte HTTP e tratamento de erros
│   ├── config.js                # Leitura e validação das variáveis de ambiente
│   ├── mcp-server.js            # Fábrica de servidores MCP
│   ├── data/
│   │   └── project-info.js       # Carregamento e esquema dos dados
│   └── tools/
│       ├── index.js             # Registro central das ferramentas
│       └── get-project-info.js  # Definição da ferramenta inicial
└── test/
    ├── config.test.js           # Configurações válidas e inválidas
    └── mcp.test.js              # Integração HTTP com cliente oficial
```

### Decisões de transporte e tratamento de erros

O transporte opera **sem estado de sessão** (`sessionIdGenerator: undefined`)
e com respostas JSON (`enableJsonResponse: true`). Streamable HTTP permite
responder a POST com JSON; SSE não é obrigatório para esta ferramenta.
Não há `Mcp-Session-Id`, armazenamento de sessões, fluxo GET/SSE nem DELETE
de sessão. Esses métodos recebem **405** e `Allow: POST`.

Cada POST cria seu próprio `McpServer` e `StreamableHTTPServerTransport`, evitando
compartilhar IDs de requisições entre clientes. O transporte é fechado quando
a resposta termina ou a conexão é encerrada.

JSON malformado recebe HTTP 400; corpos acima de 64 KiB recebem 413. O SDK
valida protocolo, cabeçalhos MCP e argumentos das ferramentas. Falhas ao ler
ou validar os dados retornam `isError: true` com uma mensagem pública; os detalhes
ficam nos logs. Falhas HTTP inesperadas retornam um erro JSON-RPC genérico.

### Expansão futura

Para adicionar ferramentas, crie um módulo em `src/tools/`, defina seu esquema,
anotações e função de leitura, e registre-o em `src/tools/index.js`. Mantenha
a obtenção de dados em `src/data/` e suas fontes explícitas.

Ferramentas planejadas, ainda **não implementadas nem anunciadas** pelo servidor:

- `search_project`
- `get_team`
- `get_references`
- `get_workshop_info`
- `get_results`
- `get_project_timeline`

## Conexão futura ao ChatGPT

Esta implementação fornece o servidor MCP. Para adicioná-lo como um conector/plugin
remoto do ChatGPT, hospede este processo Node.js em um serviço com HTTPS público,
configure o domínio em `ALLOWED_HOSTS` e use a URL completa `https://seu-dominio/mcp`.
Exemplo de configuração do processo em um serviço que fornece HTTPS externamente:

```bash
HOST=0.0.0.0 ALLOWED_HOSTS=mcp.seu-dominio.com npm start
```

O domínio acima é ilustrativo. Esta versão não realiza publicação nem cadastro
do plugin no ChatGPT. **GitHub Pages serve arquivos estáticos e não executa este
servidor Node.js**; o site público do projeto permanece a fonte das informações.
