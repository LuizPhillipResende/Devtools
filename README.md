# 🚀 DevTools CORP — Desktop Suite (v6.0)

Suíte completa e profissional de ferramentas de desenvolvimento para desktop, construída nativamente sobre Electron, HTML5, CSS3 avançado e JavaScript moderno.

---

## 💻 Como Executar

### 1. Iniciar pelo Executável da Área de Trabalho:
- Já foi criado um atalho direto na sua **Área de Trabalho**: `DevTools CORP.lnk` apontando para o executável `DevTools CORP.exe`.
- Você pode abri-lo dando um duplo clique no ícone na sua Área de Trabalho!
- O executável completo está localizado em:
  `dist\DevTools CORP-win32-x64\DevTools CORP.exe`

### 2. Iniciar em Modo de Desenvolvimento:
```bash
npm start
```
*(ou `npm run dev`)*

### 3. Gerar Novo Executável Windows (.exe):
```bash
npm run build
```

### 4. Executar os Testes Automatizados de Validação:
```bash
npm test
```

---

## 🛠️ O que foi transformado da Extensão para Desktop

1. **Liberdade Total de Resolução e Janela:**
   - Não há mais a restrição de tamanho de popup de extensão de 800×600.
   - A janela agora é fluida, redimensionável, maximizável e lembra a última dimensão selecionada pelo usuário.
2. **Sistema de Armazenamento Persistente Nativo:**
   - Substituição transparente do `chrome.storage.local` por persistência direta em arquivo JSON local (`%APPDATA%/DevTools CORP/devtools-store.json`) + sincronização instantânea em memória/localStorage.
   - Todos os diagramas, scripts do playground, tarefas de produtividade, hashes e configurações persistem permanentemente.
   - Ferramenta de **Exportar e Importar Backup (.json)** completo nas configurações.
3. **Acesso Direto ao Sistema de Arquivos (FS) do Computador:**
   - **JSON Pretty:** Abrir `.json` do PC e Salvar `.json` no disco.
   - **Diff Check:** Abrir Arquivo A e Arquivo B diretamente do disco, ou arrastar e soltar (Drag-and-Drop) arquivos sobre os painéis, e salvar arquivo modificado no PC.
   - **JS Playground:** Abrir qualquer arquivo (`.js`, `.ts`, `.json`, etc.) do computador, salvar com `Ctrl+S`.
   - **Base64:** Converter qualquer arquivo binário/imagem/PDF do computador para Base64, e salvar Base64 de volta como arquivo real no disco.
   - **Hash:** Calcular SHA-256, SHA-1 e MD5 de qualquer arquivo do computador.
   - **Automatos & ERD:** Importar e exportar diagramas completos em formato XML (.xml) e imagens PNG.
4. **Área de Transferência e Captura de Tela Nativas:**
   - Leitura nativa de imagens da área de transferência (prints tirados com `Win+Shift+S` ou `PrintScreen`).
   - Captura de telas do desktop e janelas em execução usando `desktopCapturer`.

---

## 🌟 As 3 Novas Ferramentas Adicionadas

### 1. 📷 Leitor de QR Code & Código de Barras (`js/qrcode.js`)
- **Câmera ao Vivo:** Seleção de webcam/câmera com mira iluminada, linha laser animada e decodificação contínua automática em tempo real.
- **Print da Tela / Clipboard:**
  - Botão **"📸 Capturar Tela Inteira / Janela"** diretamente do desktop.
  - Botão **"📋 Colar Print (Ctrl+V)"** para analisar capturas de tela imediatamente.
  - **Recorte Interativo (Crop / ROI):** Permite arrastar um retângulo na tela do print para isolar e ler apenas o código de interesse.
- **Arquivo de Imagem:** Arraste e solte ou selecione qualquer arquivo de imagem (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`).
- **Gerador Integrado:** Crie QR Codes (com correção de erro e download PNG) e Códigos de Barras 1D (CODE 128, EAN-13, UPC, CODE 39).
- **Resultados & Histórico:** Identificação do formato (`QR_CODE`, `EAN_13`, etc.), cópia rápida com 1 clique, abertura de URL no navegador externo e histórico de leituras recentes.

### 2. 🗄️ Canva "Automatos" com Arquitetura de Database & XML (`js/diagram.js`)
- **Tabelas de Banco de Dados (ERD):**
  - Criação visual de tabelas com nome da entidade, cabeçalho estilizado e lista de colunas.
  - Suporte a Chaves Primárias (`🔑 PK`), Chaves Estrangeiras (`🔗 FK`) e indicador Not Null (`NN`).
  - **Modal Editor de Estrutura:** Dê duplo clique em qualquer tabela para adicionar, renomear, reordenar ou excluir colunas e alterar tipos de dados (`INT`, `BIGINT`, `VARCHAR`, `TEXT`, `UUID`, `BOOLEAN`, `TIMESTAMP`, `DECIMAL`).
- **Relacionamentos de Banco de Dados:** Conector de relação com cardinalidade (`1:1`, `1:N`, `N:M`) e notação Crow's Foot.
- **Nós de Arquitetura em Nuvem & Infraestrutura:** Formas vetoriais dedicadas para *Database (Cilindro 3D)*, *Servidor Host*, *Nuvem / Cloud*, *Cache (Redis)* e *Mensageria / Fila (Kafka/RabbitMQ)*.
- **Importação e Exportação XML:**
  - **Exportar XML:** Gera documento `.xml` bem formatado contendo todas as tabelas, colunas, chaves, relações, nós, formas, coordenadas e cores.
  - **Importar XML:** Lê e reconstrói fielmente diagramas a partir de arquivos `.xml` do computador via `DOMParser`.
- **Modelos Prontos (Templates):** Carregamento imediato de templates arquiteturais (ex: *E-Commerce Database* e *Arquitetura Microserviços*).

### 3. 💻 Diff Check & JS Playground no Estilo VS Code
- **Diff Check & ChangeLog (`js/diff.js`):**
  - Visualização lado a lado (*Split*) e unificada (*Unified*) com CodeMirror MergeView.
  - Abertura de arquivos diretamente do computador para o Painel A e Painel B.
  - Suporte total a arrastar e soltar (Drag-and-Drop) arquivos do Windows Explorer.
  - Badges com contagem precisa de linhas adicionadas (`+X`) e removidas (`-Y`).
  - **Gerador Inteligente de ChangeLog:** Gera um resumo de modificações formatado em Markdown pronto para documentação de releases ou commits, com botões para copiar e salvar `CHANGELOG.md` no computador.
- **JS Playground IDE (`js/playground.js`):**
  - **Explorador de Arquivos Lateral:** Crie novos arquivos, abra arquivos do PC, salve com `Ctrl+S`.
  - **Abas de Edição:** Navegação multi-arquivo com ícones e status de arquivo modificado (`●`).
  - **Editor CodeMirror:** Numeração de linha, fechamento e realce automático de parênteses/chaves, atalho `Ctrl+Enter` para execução.
  - **Terminal Inferior Integrado:** Abas de *Console / Saída*, *Inspetor de Objetos (JSON Tree)* e *Histórico de Execuções* com métricas de tempo em milissegundos (`✓ 12ms`).
  - Execução assíncrona moderna com suporte a `await`, `Promise`, `fetch` e APIs desktop.

---

## ⌨️ Atalhos Globais

| Atalho | Ação |
|---|---|
| `Ctrl + K` | Abrir e focar a Barra de Pesquisa de Ferramentas |
| `Ctrl + Enter` | Executar script no Playground / Formatar JSON |
| `Ctrl + S` | Salvar arquivo atual no Playground / Salvar no PC |
| `Ctrl + Shift + F` | Formatar JSON Pretty |
| `V`, `R`, `E`, `D`, `A`, `T` | Modos de desenho no Canva Automatos (Selecionar, Retângulo, Elipse, Diamante, Seta, Texto) |
| `+`, `−`, `0` | Zoom in, Zoom out e Resetar zoom no Automatos |
