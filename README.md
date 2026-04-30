## DevTools CORP

O **DevTools CORP** é uma extensão para navegadores (Chrome, Edge, Brave) desenvolvida para centralizar as ferramentas essenciais do dia a dia de um desenvolvedor em uma interface única, rápida e elegante. Projetada com foco em produtividade, a ferramenta elimina a necessidade de buscar sites externos para tarefas simples de manipulação de dados.

---

## 🚀 Funcionalidades

### 🧩 Core
* **JSON Pretty:** Formatador e minificador de JSON com suporte a indentação e validação em tempo real.
* **Diff Check:** Comparador de textos (A vs B) com renderização visual de adições e remoções em tempo real.
* **Details Mock:** Template HTML customizável para geração de documentação ou especificações técnicas rápidas.

### 🛠️ Utilitários
* **Base64:** Encode e Decode de strings de texto (com suporte a UTF-8 moderno).
* **URL Tools:** Codificação/decodificação de URLs e um **Query String Parser** que transforma parâmetros de busca em uma tabela legível.
* **JWT Decoder:** Decodificador de tokens JWT com separação visual de Header e Payload, além de validação automática de status de expiração (`exp` e `iat`).
* **Regex Tester:** Testador de expressões regulares com destaque visual (highlight) dos matches no texto.
* **Timestamp:** Conversão bidirecional entre Unix Timestamp (segundos) e datas legíveis (Local, UTC, ISO), incluindo tempo relativo (ex: "há 2h").

### 🔧 Geradores
* **UUID Generator:** Gerador de UUIDs v1 (Time-based) e v4 (Random) com suporte a múltiplas gerações em lote.
* **Hash Generator:** Gerador de hashes SHA256 e MD5 com atualização em tempo real.
* **Color Converter:** Conversor bidirecional entre Hex, RGB e HSL com preview visual em tempo real.
* **JSON Schema Validator:** Validador de JSON contra schemas com suporte a tipos, propriedades obrigatórias, ranges numéricos e enums.

---

## ⌨️ Atalhos de Teclado

Para maximizar a velocidade, a extensão suporta os seguintes comandos:

* **Ctrl + Shift + F:** Formatar JSON automaticamente.
* **Ctrl + [1-8]:** Alternar rapidamente entre as abas da extensão.

---

## 🛠️ Tecnologias Utilizadas

O projeto foi construído utilizando tecnologias web padrão para garantir leveza e compatibilidade:

* **Manifest V3:** Seguindo os padrões mais recentes de segurança e performance para extensões.
* **HTML5 & CSS3:** Interface moderna com variáveis CSS para fácil manutenção de temas.
* **Vanilla JavaScript:** Lógica pura, sem dependências externas, garantindo que a extensão seja extremamente leve.
* **Chrome Storage API:** Persistência de dados local para que você não perca seu trabalho ao fechar o popup.
* **Web Crypto API:** Suporte nativo para hash SHA256 e operações criptográficas modernas.

---

## 📦 Como Instalar

Como se trata de uma ferramenta corporativa/customizada, a instalação é feita via modo de desenvolvedor:

1.  Baixe ou clone este repositório.
2.  Extraia o arquivo `.zip` (se aplicável).
3.  Abra o seu navegador e vá para `chrome://extensions/`.
4.  Ative o **"Modo do desenvolvedor"** no canto superior direito.
5.  Clique em **"Carregar sem compactação"** e selecione a pasta que contém o arquivo `manifest.json`.

---

## 📂 Estrutura do Projeto

* `manifest.json`: Configurações e permissões da extensão.
* `popup.html`: Estrutura principal da interface e views.
* `popup.js`: Lógica de todas as ferramentas e gerenciamento de estado.
* `mock.html`: Template base para a ferramenta de Mock.

---

## 🔄 Melhorias Recentes

### Correções de Robustez
- ✅ Base64: Modernizado para usar `TextEncoder`/`TextDecoder` em vez de `escape()`/`unescape()`.
- ✅ JWT Decoder: Melhorado com `TextEncoder` para suporte melhor a caracteres UTF-8.
- ✅ Regex Tester: Removido problema de múltiplos event listeners sendo adicionados em cada execução.
- ✅ Timestamp: Corrigido para aceitar corretamente timestamp 0 (1970-01-01).

### Novas Funcionalidades
- ✨ UUID Generator: Geração v1 (Time) e v4 (Random) com lote até 100 UUIDs.
- ✨ Hash Generator: SHA256 (Web Crypto API) e MD5 com atualização em tempo real.
- ✨ Color Converter: Conversão e preview em tempo real entre Hex, RGB e HSL.
- ✨ JSON Schema Validator: Validação básica contra schemas JSON (types, required, ranges, enums).