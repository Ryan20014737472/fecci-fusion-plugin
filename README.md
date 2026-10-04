# FECCI Fusion 360 — servidor MCP

V3 do servidor MCP para o plugin **FECCI Fusion 360** do ChatGPT.
Disponibiliza informações públicas do [Projeto FECCI](https://ryan20014737472.github.io/Fecci-fusion-360/)
sobre Autodesk Fusion 360, modelagem e prototipagem 3D, educação, Cultura Maker e STEAM.

Esta versão está na branch **`feat/mcp-v3-documents`**, criada a partir da `main`
estável da V2. Adiciona quatro ferramentas documentais e amplia a base consultada
por `search_project`, preservando sua entrada e seu esquema de resposta.
As definições das sete ferramentas V2 permanecem iguais; as respostas dos seis
conjuntos especializados, incluindo **`get_project_info`**, também permanecem
exatamente iguais. Os arquivos de produção e o Blueprint do Render não mudam.
Publicar esta branch não faz merge nem deploy.

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
git switch feat/mcp-v3-documents
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

## Ferramentas disponíveis

Todas as onze ferramentas são somente leitura. Declaram `readOnlyHint: true`,
`destructiveHint: false`, `idempotentHint: true` e `openWorldHint: false`, pois
consultam arquivos locais verificados. Os esquemas de entrada e saída usam Zod;
campos de entrada não previstos são rejeitados.

A resposta contém `structuredContent`, validado por um `outputSchema` Zod, e
uma representação do mesmo JSON em `content` para clientes que leem texto.
Todos os conjuntos contêm fontes e `source_checked_at`. Na V2, as fontes usam
`section` e `url`. Na V3, a proveniência documental identifica também documento,
página e seção; informações não verificadas e divergências ficam explícitas.

| Ferramenta | Argumentos | Conteúdo retornado |
| --- | --- | --- |
| `get_project_info` | `{}` ou argumentos omitidos | Informações gerais, áreas, contexto e resumo do minicurso e resultados. Contrato V1 preservado. |
| `search_project` | `{"query":"parafuso porca"}` | Até 10 trechos relevantes com `id`, `title`, `content`, fontes e data; total em `match_count`. |
| `get_team` | `{}` ou argumentos omitidos | `members` com nomes, papéis e responsabilidades; `additional_public_roles` com orientação e mentoria; `article_authorship` com a autoria publicada. |
| `get_references` | `{}` ou argumentos omitidos | `bibliography` com os três artigos, autores, citações, DOI e PDFs; `additional_materials` separa artigo do projeto, guia e links públicos. |
| `get_workshop_info` | `{}` ou argumentos omitidos | Objetivo, contexto, público, duração em minutos, status, conteúdos ordenados, atividade prática, material de apoio, avaliação e continuidade. |
| `get_results` | `{}` ou argumentos omitidos | `obtained_results`, `prepared_instruments`, `pending_steps`, objetivos ainda sem mensuração e status dos resultados quantitativos. |
| `get_project_timeline` | `{}` ou argumentos omitidos | Etapas na sequência pública do diário, status `documented`/`planned`, datas e registros sem posição cronológica confirmada. |
| `get_project_documents` | `{}` ou argumentos omitidos | Inventário de seis documentos com título, tipo, descrição, URL, páginas, data, disponibilidade e alcance da verificação. |
| `search_documents` | `{"query":"extrusão","document_type":"support_material","limit":3}` | Trechos do corpus documental, com documento, página/seção, URL direta, status, escopo, `rank`, `score` e data. Filtro e limite opcionais. |
| `get_methodology` | `{}` ou argumentos omitidos | Dez seções do método publicado, com proveniência e status por afirmação, limitações e divergências entre fontes. |
| `get_theoretical_foundation` | `{}` ou argumentos omitidos | Seis referências do artigo: autores, ano, trabalho, conceito, contribuição e vínculo metodológico publicado; fontes e variantes bibliográficas. |

### `get_project_info`: contrato mantido

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

### Compatibilidade de `search_project`

`query` é obrigatória: string de **1 a 200 caracteres após remover espaços
externos**, contendo ao menos uma palavra ou número pesquisável. Não aceita
somente pontuação ou palavras de ligação como `o e de para`. Não há parâmetro
de limite, filtros adicionais nem acesso a URLs fornecidas pelo cliente.

A busca continua usando os seis conjuntos da V2 e passa a incluir os 59 trechos
documentais da V3. Ignora caixa e acentos, elimina palavras de ligação e exige
todos os termos significativos no mesmo trecho. Aceita prefixos de pelo menos
quatro caracteres. O cálculo anterior de relevância permanece igual; empates
priorizam registros da V2 e depois o identificador. A busca é lexical.

O resultado contém `query`, `match_count`, `results`, `message`, `sources` e
`source_checked_at`. `match_count` informa o total antes do limite de 10 resultados.
Cada trecho mantém suas próprias fontes e data; a data geral é a mais antiga
entre os conjuntos consultados. Sem correspondência, `results` é `[]`,
`match_count` é `0` e `message` informa explicitamente a ausência na base local.
Uma consulta válida sem correspondência é uma resposta normal, sem `isError`.

Os resultados documentais usam os mesmos campos V2: `id`, `title`, `content`,
`sources` e `source_checked_at`. Documento, página, seção e URL direta aparecem
em `title`/`content` e na descrição da fonte. PDFs usam `#page=N` na URL da fonte.
Para o Borke, `sources.url` aponta para o link publicado no site (`#diario`), pois
o schema V2 admite somente URLs desse domínio; o link direto do Canva permanece
em `content`. Não foram acrescentados campos ao contrato antigo.

### `search_documents`: parâmetros e ranking

| Parâmetro | Regra |
| --- | --- |
| `query` | Obrigatória; mesmas regras de texto de `search_project`: 1 a 200 caracteres após trim e pelo menos um termo pesquisável. |
| `document_type` | Opcional: `project_article`, `support_material`, `project_journal` ou `bibliographic_reference`. |
| `limit` | Opcional; inteiro entre 1 e 10. Padrão: 5. |

A busca consulta exclusivamente `data/document-corpus.json`. Todos os termos
significativos devem ocorrer no título ou conteúdo do mesmo trecho. A
normalização remove acentos, ignora caixa e palavras de ligação em português.
Prefixos são aceitos a partir de quatro caracteres; não há interpretação de
sinônimos, busca semântica ou acesso à internet.

O ranking soma, por termo, 8 pontos por correspondência exata no título e 2 no
conteúdo; prefixos recebem 4 e 1. A frase normalizada acrescenta 20 pontos no
título e 5 no conteúdo. Um bônus de especificidade é
`floor(32 × termos da consulta presentes no título / termos significativos do título)`.
Empates usam o identificador do trecho. `score` expressa relevância lexical;
`rank` começa em 1. Não representa confiança científica ou certeza de execução.

`match_count` informa o total antes do limite. Cada resultado conserva os cinco
campos de proveniência, `status`, `scope` e eventual `additional_provenance` de
passagens que atravessam páginas. Sem correspondência, retorna lista vazia e
mensagem explícita. O filtro `bibliographic_reference` é válido, mas não encontra
trechos nesta versão: esses PDFs foram inventariados, sem incorporar seu corpo.

### Metodologia e fundamentação

`get_methodology` organiza `sections` em `planning`, `preparation`,
`target_audience`, `duration`, `lesson_organization`, `practical_activities`,
`evaluation_instruments`, `application`, `analysis` e `limitations`. Cada seção
contém `facts`, com texto, status e uma ou mais proveniências. `ambiguities` e
`not_verified` conservam divergências e lacunas, sem resolvê-las por inferência.

`get_theoretical_foundation` inclui Anderson, Autodesk, Chang/Melo/Silva,
Evangelista/Oliveira, Lavicza/Abar/Tejera e Lipson/Kurman. Cada referência declara
autores, ano e sua base, trabalho, `concept_used`, `contribution`,
`methodology_link`, fontes e variantes de citação. Quando o projeto não relaciona
a referência a uma etapa específica do minicurso, o vínculo é declarado como
`not_published`. A bibliografia de três artigos retornada por `get_references`
permanece igual à V2.

## Base documental e proveniência

A V3 é um retrato **verificado em 2026-10-04**. Os seis arquivos da V2 permanecem
com seus dados e datas anteriores (**2026-10-03**). Nenhuma chamada MCP consulta
PDFs, Canva ou páginas externas. Os quatro novos JSONs contêm sínteses factuais,
sem PDFs, texto integral dos documentos ou dependências de extração em produção.

| Arquivo | Papel |
| --- | --- |
| `data/documents.json` | Inventário, disponibilidade, páginas, método de verificação, escopo e checksums. |
| `data/document-corpus.json` | Trechos curados pesquisáveis, status, escopo, proveniência e cobertura. |
| `data/methodology.json` | Síntese das dez partes do método, com fontes por afirmação. |
| `data/theoretical-foundation.json` | Referências, conceitos, contribuições, vínculos publicados e divergências de citação. |

Os datasets têm `schema_version: 1`. `src/data/document-datasets.js` lê caminhos
fixos, valida os schemas Zod e confere título, URL, data, páginas, identificadores
e contagens contra o inventário. O registro central das ferramentas permanece
em `src/tools/index.js`; os serviços de busca ficam em `src/search/`.

### Documentos consultados e cobertura

Todos os documentos foram encontrados pelos links atuais do site oficial.
As URLs completas estão em `data/documents.json` e no retorno de
`get_project_documents`.

| Documento | Páginas verificadas | Conteúdo incorporado |
| --- | --- | --- |
| Artigo **Desenvolvimento de competências STEAM por meio de um minicurso de prototipagem 3D utilizando o Autodesk Fusion 360** | 5 páginas PDF | 28 trechos, cobrindo as 5 páginas. |
| **Material de apoio — Oficina Fusion 360** | 7 páginas PDF | 22 trechos, cobrindo as 7 páginas; tabelas e infográficos das páginas 4–6 revisados visualmente. |
| **Borke final**, pelo [link público do diário](https://canva.link/ino42l26d4v7d6u) | 11 páginas na ordem do design Canva | 9 trechos, em 6 páginas: 1, 2, 3, 4, 6 e 8. |
| Evangelista/Oliveira — **Estudo das consequências da aplicação de impressoras 3D no ambiente escolar** | 20 páginas PDF | Disponibilidade e metadados; sem texto no corpus. |
| Chang/Melo/Silva — **Manufatura aditiva e o ambiente maker: sinergia para transformar o ensino de desenho técnico e modelagem 3D** | 23 páginas PDF | Disponibilidade e metadados; sem texto no corpus. |
| Lavicza/Abar/Tejera — **O pensamento geométrico espacial e sua articulação com a visualização e a manipulação de objetos em 3D** | 20 páginas PDF | Disponibilidade e metadados; sem texto no corpus. |

O corpus contém **59 trechos de 3 documentos, cobrindo 18 páginas**. Foram
consultadas todas as 12 páginas dos dois PDFs do próprio projeto. Os três PDFs
bibliográficos adicionais somam 63 páginas e estão somente no inventário.
A fundamentação registra o uso dessas referências publicado pelo próprio FECCI.

O Borke pôde ser lido anonimamente no texto da resposta pública do Canva, com
identificação de navegador atual; não foi necessária conta ou edição. Sua paginação é a ordem
do design (`page_basis: "canva_design_order"`), não a de uma exportação PDF.
Não foi obtida uma exportação PDF pública do diário. Fotografias, manuscritos,
páginas sem texto suficiente e informações presentes somente em imagens não
foram transcritos. `content_sha256` identifica os bytes dos PDFs; no diário,
identifica a representação JSON dos textos extraídos, conforme `checksum_kind`.

### Política de proveniência

Todo trecho e toda afirmação documental guardam:

```json
{
  "document_title": "Material de apoio — Oficina Fusion 360",
  "source_url": "https://ryan20014737472.github.io/Fecci-fusion-360/assets/mat%C3%A9rial%20de%20apoio.pdf",
  "page": 4,
  "section": "Ferramentas utilizadas na oficina",
  "source_checked_at": "2026-10-04"
}
```

`page` e `section` são obrigatórios, aceitando `null` quando não disponíveis.
Páginas são contadas a partir de 1. Seções identificadas por assunto de uma
tabela ou lista não implicam numeração de seção no original. Fontes HTML usam
página `null`. Passagens que atravessam páginas mantêm ambas as referências.
O inventário distingue `availability: "available"` de `"not_verifiable"` e
informa `corpus_included`; estar disponível não significa ter texto indexado.

O campo `status` separa `documented`, `planned`, `expected`, `context`,
`ambiguous` e `not_published`. `scope` diferencia projeto, material didático,
atividades gerais do clube e referências de terceiros. A capacitação-piloto
é preparação documentada; a aplicação às turmas e a comparação pré/pós
continuam planejadas. Competências, modelos funcionais e interesse por
carreiras descritos como expectativas não são resultados medidos do FECCI.

### Divergências e exclusões deliberadas

- O artigo menciona estudantes de outros colégios na página 2 e turmas do CEP
  na página 3. As duas formulações permanecem com suas fontes.
- O artigo prevê ao menos cinco turmas; o site registra sete turmas conseguidas
  para aplicação. Esses números não comprovam atendimento realizado nem
  permitem ordenar as atualizações.
- A metodologia do artigo descreve materiais em preparação; seus resultados
  parciais descrevem materiais desenvolvidos. Os contextos são conservados.
- Evangelista/Oliveira aparece como **2021** no corpo do artigo e no site, mas
  como **2026** na bibliografia do PDF, com volume e DOI diferentes. Todas as
  variantes ficam explícitas; nenhuma foi corrigida por uma fonte externa.
- O site descreve o Borke em produção; o design se chama **Borke final**. Esse
  título não comprova conclusão do minicurso. Datas como `09-03` e `13-04`
  permanecem sem ano. O resumo de `get_project_timeline` não foi alterado.
- Medidas ilustradas no guia não viraram dimensões obrigatórias da peça.
  O estilo de navegação Tinkercad citado no material não comprova a aplicação
  completa às turmas. Atalhos conservam a ressalva do estilo configurado.
- Não foram incorporados contatos pessoais do artigo, transcrições de imagens,
  nomes expandidos por inferência, o significado da sigla FECCI, datas de
  aplicação, número de alunos atendidos ou resultados quantitativos ausentes.
- Estatísticas de pesquisas bibliográficas não foram atribuídas ao FECCI.
  Os vínculos metodológicos específicos de Anderson e Lipson/Kurman não estão
  publicados no artigo e são declarados como ausentes.

### Atualizar os dados

1. Verifique novamente o site e os documentos atualmente vinculados por ele.
   Faça downloads e extração fora do repositório; confira páginas e checksum.
2. Leia os PDFs e revise visualmente tabelas/infográficos. Para o diário, use
   somente conteúdo público verificável; registre a base da paginação.
3. Edite apenas trechos e afirmações confirmados. Preencha os cinco campos de
   proveniência, mantenha datas de verificação coerentes e classifique estágio
   e escopo. Preserve divergências e registre o que não pôde ser verificado.
4. Atualize inventário, corpus, sínteses e contagens de cobertura em conjunto.
   Mantenha apenas trechos necessários; não versione PDFs ou respostas brutas
   do Canva. O servidor não precisa de ferramentas de extração instaladas.
5. Execute `npm test`, `npm run check` e `git diff --check`. Não atualize as
   fixtures de compatibilidade para aceitar uma quebra da V1/V2. A expansão
   de `search_project` mantém seu schema anterior.

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

Resultado esperado: as onze ferramentas da tabela, com os esquemas de entrada,
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

### 5. Pesquisar informações locais

```bash
curl -sS http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"search_project","arguments":{"query":"parafuso porca"}}}'
```

Resultado esperado: trechos sobre a atividade prática, com título, conteúdo e
fontes oficiais. Consultas como `capacitação`, `Ryan`, `referências` e `90 minutos`
também encontram informações publicadas. `termozxyinexistente` retorna lista vazia.

### 6. Consultar os conjuntos especializados

Exemplos de `params` para `method: "tools/call"`, usando os mesmos cabeçalhos:

| Consulta | `params` |
| --- | --- |
| Equipe e papéis | `{"name":"get_team","arguments":{}}` |
| Referências bibliográficas e recursos | `{"name":"get_references","arguments":{}}` |
| Minicurso de 90 minutos | `{"name":"get_workshop_info","arguments":{}}` |
| Evidências e resultados pendentes | `{"name":"get_results","arguments":{}}` |
| Sequência do diário público | `{"name":"get_project_timeline","arguments":{}}` |
| Documentos públicos e disponibilidade | `{"name":"get_project_documents","arguments":{}}` |
| Método publicado e seus estágios | `{"name":"get_methodology","arguments":{}}` |
| Conceitos e referências do artigo | `{"name":"get_theoretical_foundation","arguments":{}}` |

Para executar todos esses exemplos:

```bash
for tool in get_team get_references get_workshop_info get_results get_project_timeline get_project_documents get_methodology get_theoretical_foundation; do
  curl -sS http://127.0.0.1:3000/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H 'MCP-Protocol-Version: 2025-11-25' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"$tool\",\"arguments\":{}}}"
done
```

Essas ferramentas não recebem filtros ou identificadores. Argumentos extras
geram `isError: true`. Falhas de leitura ou validação da base também geram
`isError: true`, com mensagem pública genérica e sem detalhes internos.

### 7. Pesquisar no corpus documental

```bash
curl -sS http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"search_documents","arguments":{"query":"extrusão","document_type":"support_material","limit":3}}}'
```

Resultado esperado: a explicação de **Extrude/extrusão** no guia aparece antes
de menções gerais ao comando. Os resultados incluem URL do PDF, página, seção,
ranking e data. Exemplos adicionais de `params`:

| Consulta | `params` |
| --- | --- |
| Metodologia do artigo | `{"name":"search_documents","arguments":{"query":"questionários","document_type":"project_article"}}` |
| Registro público do clube | `{"name":"search_documents","arguments":{"query":"Bordo Maker","document_type":"project_journal","limit":1}}` |
| Sem correspondência | `{"name":"search_documents","arguments":{"query":"termozxyinexistente"}}` |

### Testes automatizados

```bash
npm test
npm run check
```

Os testes usam `node:test` e o cliente oficial do SDK em portas locais temporárias.
Verificam inicialização, descoberta e chamada de todas as ferramentas, conteúdo estruturado,
chamadas concorrentes, notificações, erros de JSON, limite de corpo, validação
de argumentos, métodos HTTP, `Host`/`Origin`, falha na leitura, configuração pública,
`/health`, entrada real com `PORT` da hospedagem, bind em `0.0.0.0` e encerramento
por `SIGTERM`. Os testes de configuração pública também conferem que a resposta
de `get_project_info` continua igual aos dados verificados do projeto. A suíte V2
compara a definição e as respostas completas da V1, valida os JSON Schemas
anunciados com o validador do SDK, rejeita argumentos inválidos, verifica fontes,
datas, falhas de leitura, busca sem correspondência, ordenação e limite de
resultados. A suíte V3 verifica as onze ferramentas, hashes dos contratos e
respostas V2, compatibilidade com o schema antigo de `search_project`, filtros,
limites, ranking e normalização de acentos. Também rejeita fatos sem fonte,
páginas inexistentes, inconsistências de cobertura e regressões que convertam
aplicação planejada ou resultados esperados em execução e resultados obtidos.
Chamadas repetidas verificam idempotência e os hashes dos arquivos de dados
confirmam que as ferramentas não os modificam. `npm run check` verifica
a sintaxe de todos os arquivos JavaScript do servidor, scripts e testes.
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
│   ├── project-info.json         # Dados V1 preservados
│   ├── team.json                 # Equipe, papéis e autoria
│   ├── references.json           # Bibliografia e recursos públicos
│   ├── workshop-info.json        # Minicurso e material de apoio
│   ├── results.json              # Evidências obtidas e etapas pendentes
│   ├── project-timeline.json     # Resumo V2 do diário preservado
│   ├── documents.json            # Inventário documental V3
│   ├── document-corpus.json      # Trechos curados pesquisáveis
│   ├── methodology.json          # Método publicado e proveniência
│   └── theoretical-foundation.json # Conceitos, referências e variantes
├── scripts/
│   └── check.js                 # Verificação de sintaxe de todos os JS
├── src/
│   ├── app.js                   # /mcp, /health, transporte HTTP e erros
│   ├── config.js                # Leitura e validação das variáveis de ambiente
│   ├── mcp-server.js            # Fábrica de servidores MCP
│   ├── data/
│   │   ├── project-info.js       # Carregamento e esquema V1 preservados
│   │   ├── project-schemas.js    # Esquemas Zod dos conjuntos V2
│   │   ├── project-datasets.js   # Carregamento dos JSON V2
│   │   ├── document-schemas.js   # Schemas Zod documentais V3
│   │   └── document-datasets.js  # Leitura e integridade da proveniência
│   ├── search/
│   │   ├── project-search.js     # Busca V2 com registros V3 adicionais
│   │   ├── document-search.js    # Ranking lexical do corpus documental
│   │   └── project-document-search.js # Adaptador para o contrato V2
│   └── tools/
│       ├── index.js             # Registro central das ferramentas
│       ├── get-project-info.js  # Ferramenta V1 preservada
│       ├── read-only-tool.js    # Resposta estruturada e erros das novas ferramentas
│       ├── search-project.js    # Busca textual local
│       ├── get-team.js          # Equipe e papéis
│       ├── get-references.js    # Bibliografia e recursos
│       ├── get-workshop-info.js # Minicurso
│       ├── get-results.js       # Resultados e pendências
│       ├── get-project-timeline.js # Diário e etapas públicas V2
│       ├── get-project-documents.js # Inventário V3
│       ├── search-documents.js   # Pesquisa documental V3
│       ├── get-methodology.js    # Metodologia V3
│       └── get-theoretical-foundation.js # Fundamentação V3
└── test/
    ├── config.test.js           # Configurações válidas e inválidas
    ├── mcp.test.js              # Integração HTTP com cliente oficial
    ├── public-http.test.js      # Domínios públicos, Origin e /health
    ├── server.test.js           # Processo real, porta, bind e SIGTERM
    ├── search.test.js           # Busca, relevância, limite e proveniência
    ├── v2-tools.test.js         # Seis ferramentas, schemas e compatibilidade V1
    ├── v3-tools.test.js         # Onze ferramentas e compatibilidade V2
    ├── document-data.test.js    # Proveniência e regressões conceituais
    └── fixtures/
        ├── get-project-info-v1.json # Contrato e respostas V1 congelados
        └── v2-contracts.json    # Hashes dos contratos e respostas V2
```

### Decisões de transporte e tratamento de erros

O transporte opera **sem estado de sessão** (`sessionIdGenerator: undefined`)
e com respostas JSON (`enableJsonResponse: true`). Streamable HTTP permite
responder a POST com JSON; SSE não é obrigatório para estas ferramentas.
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

As ferramentas V1, V2 e as quatro documentais V3 estão implementadas.
Novos conjuntos devem declarar fonte oficial, data e informações ausentes; use
`registerReadOnlyTool` para manter o mesmo contrato de resposta e erros. Mantenha
os módulos e dados existentes preservados para não alterar seus contratos.

## Deploy público no Render

`render.yaml` prepara um **Web Service Node.js**, usando a branch
**`feat/render-deploy`**, com estas configurações:

O serviço existente e os arquivos de produção permanecem preservados na V3.
O campo `branch` do Blueprint continua com seu valor anterior; ele não comprova
qual branch foi selecionada manualmente no serviço já existente. As instruções
abaixo são referência para provisionamento futuro. Publicar
`feat/mcp-v3-documents` no GitHub não altera o serviço nem executa deploy.

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
   a V3 para produção nesta preparação. A branch de deploy existente foi preservada.
3. Revise o serviço, o plano Free e a região; confirme a criação. Não há
   credenciais da aplicação para preencher. O Blueprint define as três variáveis
   listadas acima; o Render fornece `PORT` e `RENDER_EXTERNAL_HOSTNAME`.
4. Aguarde o build, os testes e o health check, até o serviço aparecer como **Live**.
   Copie a URL HTTPS real atribuída ao serviço. O nome final pode receber um sufixo;
   use a URL exibida no Dashboard.
5. Verifique `https://HOSTNAME-REAL.onrender.com/health`: deve retornar HTTP 200 e
   `{"status":"ok"}`. Teste o MCP pelos exemplos de `curl` deste README,
   substituindo `http://127.0.0.1:3000/mcp` por
   `https://HOSTNAME-REAL.onrender.com/mcp`.

Se preferir criar o serviço sem Blueprint, escolha **New > Web Service**, conecte
o mesmo repositório, selecione a branch `feat/render-deploy`, deixe a raiz do
projeto sem subdiretório e copie os valores da tabela, incluindo as variáveis
de ambiente e `/health`. A versão do Node é lida de `.node-version`; remova um
`NODE_VERSION` antigo caso exista no Dashboard, pois ele tem precedência sobre
esse arquivo.

Para novos commits na branch de produção, use **Manual Deploy > Deploy latest commit**.
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
MCP. A disponibilidade de uma versão específica deve ser confirmada no serviço
após seu deploy; os testes locais não publicam a V3.

Nenhum token, senha ou chave é necessário no repositório. `.env` está excluído
pelo `.gitignore`; configurações particulares devem ficar no Dashboard do Render.

Referências: [Web Services](https://render.com/docs/web-services),
[variáveis da plataforma](https://render.com/docs/environment-variables),
[health checks](https://render.com/docs/health-checks),
[versão do Node](https://render.com/docs/node-version),
[Blueprint](https://render.com/docs/blueprint-spec) e
[limites do plano Free](https://render.com/docs/free).

## Conexão ao ChatGPT

O conector/plugin do ChatGPT utiliza a URL HTTPS terminada em **`/mcp`**.
O endpoint `/health` serve para monitoramento. O serviço já em produção continua
com a versão selecionada no Render; as quatro ferramentas documentais estarão
disponíveis publicamente somente após uma publicação futura autorizada.
Esta alteração publica apenas a branch de desenvolvimento, sem merge ou deploy.

**GitHub Pages serve arquivos estáticos e não executa este servidor Node.js**;
o site público do projeto permanece a fonte das informações.
