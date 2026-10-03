# FECCI Fusion 360 — servidor MCP

Primeira versão do servidor MCP para o plugin **FECCI Fusion 360** do ChatGPT.
Disponibiliza informações públicas do [Projeto FECCI](https://ryan20014737472.github.io/Fecci-fusion-360/)
sobre Autodesk Fusion 360, modelagem e prototipagem 3D, educação, Cultura Maker e STEAM.

Implementado em JavaScript com Node.js, Express e o SDK oficial
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk).
O transporte é **Streamable HTTP**, no endpoint **`/mcp`**. Esta versão não inclui
autenticação nem interface gráfica. O endpoint **`GET /health`** permite verificar
se o processo está respondendo, sem divulgar configuração ou dados do projeto.

## Instalação

Requisitos: Node.js **22 a 24** e npm. O Render usa **24.19.0**, fixado em
`.node-version` e testado nesta preparação. O `package-lock.json` fixa as versões
das dependências usadas nos testes.

```bash
git clone https://github.com/Ryan20014737472/fecci-fusion-plugin.git
cd fecci-fusion-plugin
git switch feat/render-deploy
npm ci
```

## Execução

```bash
npm start
```

O processo escuta por padrão em **`0.0.0.0:3000`**. Para execução local, acesse
**`http://127.0.0.1:3000/mcp`**. Sem um domínio configurado, o modo de desenvolvimento
aceita somente os hosts locais `localhost`, `127.0.0.1` e `[::1]`.
O terminal imprime a interface e a porta quando o servidor está pronto.
Para desenvolvimento com reinicialização automática:

```bash
npm run dev
```

As configurações são lidas das variáveis de ambiente:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` fora da hospedagem | Porta inteira entre 1 e 65535. No Render, use o valor fornecido pela plataforma; não o sobrescreva com a porta local. |
| `HOST` | `0.0.0.0` | Interface de escuta, compatível com o encaminhamento de tráfego do Render. |
| `NODE_ENV` | Não definida | Use `production` no Render; o Blueprint já configura esse valor. Em produção, uma escuta pública exige hosts explicitamente configurados por uma das três variáveis abaixo. |
| `PUBLIC_DOMAIN` | Não definido | Hostname do domínio próprio, por exemplo `mcp.seu-dominio.com`, sem `https://`, porta, caminho ou curinga. Opcional se usar apenas a URL do Render. |
| `RENDER_EXTERNAL_HOSTNAME` | Fornecida pelo Render | Hostname real `*.onrender.com` atribuído ao serviço. O servidor o inclui automaticamente na lista de hosts permitidos, mesmo quando há `PUBLIC_DOMAIN`. Não configure um valor fictício no Dashboard. |
| `ALLOWED_HOSTS` | Nenhum host extra | Outros nomes/IPs exatos permitidos, separados por vírgulas. Somam-se a `PUBLIC_DOMAIN` e ao hostname do Render. Sem esquema, porta, caminho ou curinga. Para IPv6, use colchetes, como `[::1]`. |
| `ALLOWED_ORIGINS` | Nenhuma | Origens exatas autorizadas, como `http://localhost:6274`, separadas por vírgulas. Requisições sem `Origin` são aceitas; um `Origin` não autorizado recebe HTTP 403. |

As listas são validadas na inicialização e aplicadas a **`/mcp` e `/health`**.
Configurar `PUBLIC_DOMAIN` não autoriza automaticamente um cabeçalho `Origin`.
Se um cliente enviar esse cabeçalho, inclua sua origem exata em `ALLOWED_ORIGINS`.
O servidor não usa `X-Forwarded-Host` para ampliar a lista de hosts aceitos.

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

Exemplo fora do Render com configuração de produção e domínio público:

```bash
NODE_ENV=production PUBLIC_DOMAIN=mcp.seu-dominio.com PORT=8080 npm start
```

O domínio é ilustrativo. Nesse exemplo, requisições locais com `Host: 127.0.0.1`
recebem 403; para testes locais desse processo use `Host: mcp.seu-dominio.com`
ou acrescente `127.0.0.1` em `ALLOWED_HOSTS`.

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
de argumentos, métodos HTTP, `Host`/`Origin`, falha na leitura, configuração pública,
`/health`, entrada real com `PORT` da hospedagem, bind em `0.0.0.0` e encerramento
por `SIGTERM`. Os testes de configuração pública também conferem que a resposta
de `get_project_info` continua igual aos dados verificados do projeto.
Não precisam do site disponível nem de credenciais.

### Health check

```bash
curl -i http://127.0.0.1:3000/health
```

Resultado esperado: HTTP **200**, `Cache-Control: no-store` e apenas
`{"status":"ok"}`. `HEAD /health` também é aceito, sem corpo. Métodos de escrita
recebem 405. O endpoint verifica a resposta do processo HTTP; não faz consultas
externas, não carrega o arquivo do projeto e não expõe versões, variáveis de
ambiente, caminhos locais, memória ou logs.

## Estrutura do projeto

```text
.
├── server.js                    # Inicialização HTTP e encerramento por sinal
├── package.json                 # Dependências, versão, scripts e requisito de Node
├── package-lock.json            # Versões resolvidas das dependências
├── .env.example                 # Exemplo de configuração opcional
├── .gitignore                   # Exclusões de dependências e arquivos locais
├── .node-version                # Versão do Node usada pelo Render
├── render.yaml                  # Blueprint do Web Service no Render
├── data/
│   └── project-info.json         # Fatos públicos com fontes e data de consulta
├── src/
│   ├── app.js                   # /mcp, /health, transporte HTTP e erros
│   ├── config.js                # Leitura e validação das variáveis de ambiente
│   ├── mcp-server.js            # Fábrica de servidores MCP
│   ├── data/
│   │   └── project-info.js       # Carregamento e esquema dos dados
│   └── tools/
│       ├── index.js             # Registro central das ferramentas
│       └── get-project-info.js  # Definição da ferramenta inicial
└── test/
    ├── config.test.js           # Configurações válidas e inválidas
    ├── mcp.test.js              # Integração HTTP com cliente oficial
    ├── public-http.test.js      # Domínios públicos, Origin e /health
    └── server.test.js           # Processo real, porta, bind e SIGTERM
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

## Deploy público no Render

`render.yaml` prepara um **Web Service Node.js**, usando a branch
**`feat/render-deploy`**, com estas configurações:

| Campo | Valor |
| --- | --- |
| Nome | `fecci-fusion-mcp` |
| Runtime | Node |
| Build command | `npm ci --omit=dev && npm run check && npm test` |
| Start command | `npm start` |
| Health check path | `/health` |
| Node | `24.19.0`, via `.node-version` |
| Variáveis definidas pelo Blueprint | `NODE_ENV=production`, `HOST=0.0.0.0`, `SKIP_INSTALL_DEPS=true` |
| Plano | Free (`plan: free`), com suspensão após 15 minutos sem tráfego. |
| Deploys automáticos | Desativados (`autoDeployTrigger: "off"`). O primeiro deploy ocorre ao criar o serviço; os seguintes são manuais. |

O build instala pelo lockfile, verifica a sintaxe e executa todos os testes.
Uma falha impede que essa versão seja publicada. Os testes usam apenas dependências
de produção; não é necessário instalar dependências de desenvolvimento.
`SKIP_INSTALL_DEPS=true` desativa a instalação automática adicional do Render,
pois o build já executa `npm ci`.

O Blueprint usa `plan: free`, válido para um Web Service Node.js conforme a
[referência atual do Blueprint](https://render.com/docs/blueprint-spec).
O [plano Free](https://render.com/docs/free) permite domínios próprios e TLS gerenciado,
mas suspende o serviço após 15 minutos sem tráfego; a retomada leva cerca de um minuto
e pode atrasar uma chamada MCP. Há 750 horas gratuitas por workspace a cada mês;
ao esgotá-las, os serviços Free ficam suspensos até o mês seguinte. O Render recomenda
Free para testes, projetos pessoais e prévias, em vez de aplicações de produção.
Revise o plano Free e a região antes de criar o serviço.

### Passos manuais no Render

1. Entre no [Dashboard do Render](https://dashboard.render.com/) e conecte a conta
   GitHub que tem acesso ao repositório `Ryan20014737472/fecci-fusion-plugin`.
2. Selecione **New > Blueprint**, escolha esse repositório e a branch
   **`feat/render-deploy`**, e use o arquivo **`render.yaml`** na raiz. Não selecione
   `main` nesta preparação: a configuração de deploy está na nova branch.
3. Revise o serviço, o plano Free e a região; confirme a criação. Não há
   credenciais da aplicação para preencher. O Blueprint define as três variáveis
   listadas acima; o Render fornece `PORT` e `RENDER_EXTERNAL_HOSTNAME`.
4. Aguarde o build, os testes e o health check, até o serviço aparecer como **Live**.
   Copie a URL HTTPS real atribuída ao serviço. O nome final pode receber um sufixo;
   use a URL exibida no Dashboard.
5. Verifique `https://HOSTNAME-REAL.onrender.com/health`: deve retornar HTTP 200 e
   `{"status":"ok"}`. Teste o MCP pelos quatro passos de `curl` deste README,
   substituindo `http://127.0.0.1:3000/mcp` por
   `https://HOSTNAME-REAL.onrender.com/mcp`.

Se preferir criar o serviço sem Blueprint, escolha **New > Web Service**, conecte
o mesmo repositório, selecione a branch `feat/render-deploy`, deixe a raiz do
projeto sem subdiretório e copie os valores da tabela, incluindo as variáveis
de ambiente e `/health`. A versão do Node é lida de `.node-version`; remova um
`NODE_VERSION` antigo caso exista no Dashboard, pois ele tem precedência sobre
esse arquivo.

Para novos commits nesta branch, use **Manual Deploy > Deploy latest commit**.
O deploy inicial não depende de merge na `main`. Uma futura mudança da branch
de deploy deve ser feita explicitamente no serviço/Blueprint.

### HTTPS e domínio próprio

O Render termina o TLS e fornece HTTPS público, encaminhando internamente as
requisições HTTP para `0.0.0.0:$PORT`. Não é necessário criar certificados ou
chaves TLS dentro do projeto. A URL padrão `*.onrender.com` é suficiente para
o primeiro deploy e é aceita automaticamente pela validação de `Host`.

Para um domínio próprio, execute também estes passos:

1. Em **Environment**, defina `PUBLIC_DOMAIN` com o hostname exato, por exemplo
   `mcp.seu-dominio.com`, e aplique a alteração com um novo deploy.
2. Em **Settings > Custom Domains**, adicione o domínio e configure no provedor
   DNS os registros indicados pelo Render. Aguarde a verificação e a emissão
   do certificado HTTPS.
3. Se cadastrar outros domínios no serviço, adicione todos em `ALLOWED_HOSTS`,
   separados por vírgulas, e publique a nova configuração. O Render pode usar
   qualquer domínio próprio verificado no cabeçalho `Host` de seus health checks.
4. Use `https://mcp.seu-dominio.com/mcp` como endpoint público. A URL original
   do Render continua permitida, inclusive para verificações de saúde.

`ALLOWED_ORIGINS` só precisa de configuração se o cliente enviar `Origin`.
Informe a origem completa e exata, incluindo esquema e eventual porta, sem
caminho. Não use `*`. Clientes MCP que fazem requisições sem `Origin` continuam
funcionando com o padrão vazio.

### Verificações antes de publicar

Além dos testes do build, execute:

```bash
npm audit --omit=dev
git diff --check
```

O deploy usa dependências fixadas no lockfile, corpo de requisição limitado a
64 KiB, validação de `Host` e `Origin`, mensagens públicas de erro e encerramento
por `SIGTERM`. `get_project_info`, seu esquema e seus dados permanecem iguais.
Sem autenticação, o endpoint público oferece informações públicas do projeto.
`/health` é um teste de resposta HTTP; a chamada da ferramenta verifica o conteúdo
MCP. A disponibilidade real do HTTPS só pode ser confirmada após criar o serviço.

Nenhum token, senha ou chave é necessário no repositório. `.env` está excluído
pelo `.gitignore`; configurações particulares devem ficar no Dashboard do Render.

Referências: [Web Services](https://render.com/docs/web-services),
[variáveis da plataforma](https://render.com/docs/environment-variables),
[health checks](https://render.com/docs/health-checks),
[versão do Node](https://render.com/docs/node-version),
[Blueprint](https://render.com/docs/blueprint-spec) e
[limites do plano Free](https://render.com/docs/free).

## Conexão ao ChatGPT

Depois do deploy, cadastre a URL HTTPS real terminada em **`/mcp`** no conector/plugin
do ChatGPT. O endpoint `/health` serve para monitoramento. Esta preparação publica
os arquivos de deploy no GitHub; a criação do serviço no Render e o cadastro no
ChatGPT são etapas manuais.

**GitHub Pages serve arquivos estáticos e não executa este servidor Node.js**;
o site público do projeto permanece a fonte das informações.
