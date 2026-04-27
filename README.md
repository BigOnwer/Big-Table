<div align="center">

# 📊 Big Table

### Planilha Interativa de Notas para Professores

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Recharts](https://img.shields.io/badge/Recharts-22C55E?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0zIDN2MThIMjFWM0gzem0xNiAxNkw3IDcuMTRsLTIuNSAzLjg2VjE5SDV2LTJIN3YtM2wzLTQuNUwxNyAxN2gydi0yeiIvPjwvc3ZnPg==&logoColor=white)](https://recharts.org/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

**[🌐 Demo ao vivo](https://gs-table.vercel.app)** • **[📋 Reportar Bug](https://github.com/BigOnwer/Big-Table/issues)** • **[💡 Sugerir Feature](https://github.com/BigOnwer/Big-Table/issues)**

</div>

---

## 📖 Sobre o Projeto

O **Big Table** é uma planilha interativa voltada para professores, inspirada na experiência do Excel. A ferramenta permite lançar notas de alunos e, a partir desses dados, gerar cálculos automáticos como médias, teto de notas e comparações — sem precisar escrever uma fórmula manualmente. Os resultados podem ser visualizados em diferentes tipos de gráficos gerados automaticamente, facilitando a análise de desempenho da turma.

---

## ✨ Funcionalidades

- 📋 **Tabela de notas** estilo planilha — intuitiva como o Excel
- ➕ **Fórmulas automáticas** — médias, teto de notas, totais e comparações calculados em tempo real
- 📈 **Geração de gráficos** — múltiplos tipos de visualização (barras, linhas, pizza e mais) com Recharts
- 🔢 **Comparação de valores** — análise comparativa entre alunos, turmas ou períodos
- 🎯 **Teto de notas configurável** — defina o valor máximo e veja os cálculos se ajustarem automaticamente
- 📊 **Médias automáticas** — individual por aluno e geral por turma
- 🗂️ **Painéis redimensionáveis** — layout flexível com `react-resizable-panels`
- 🔍 **Command palette** (`cmdk`) — acesso rápido a ferramentas e ações
- 🌓 **Tema claro/escuro** com `next-themes`
- 📅 **Calendário integrado** com `react-day-picker`
- 📱 **Interface responsiva** com shadcn/ui + Tailwind CSS v4
- 📊 **Analytics de uso** via `@vercel/analytics`

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Linguagem** | TypeScript |
| **Estilização** | Tailwind CSS v4 + tw-animate-css |
| **Componentes UI** | shadcn/ui + Radix UI (suite completa) + Lucide React |
| **Gráficos** | Recharts |
| **Carrossel** | Embla Carousel |
| **Drawer** | Vaul |
| **Command Palette** | cmdk |
| **Formulários** | React Hook Form + Zod |
| **Datas** | date-fns + react-day-picker |
| **Temas** | next-themes |
| **Notificações** | Sonner |
| **Analytics** | @vercel/analytics |
| **Deploy** | Vercel |

---

## 🗂️ Estrutura do Projeto

```
big-table/
├── app/                  # Rotas e páginas (Next.js App Router)
├── components/
│   ├── ui/               # Componentes shadcn/ui (accordion, dialog, tabs...)
│   └── ...               # Componentes da aplicação (tabela, gráficos, toolbar)
├── hooks/                # Custom hooks (lógica de fórmulas, estado da planilha)
├── lib/                  # Utilitários e funções de cálculo
├── styles/               # Estilos globais e variáveis CSS
└── public/               # Assets estáticos
```

---

## 🚀 Como Rodar Localmente

### Pré-requisitos

- Node.js 18+
- npm

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/BigOnwer/Big-Table.git
cd Big-Table

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

> Não há necessidade de banco de dados ou variáveis de ambiente.

---

## 🏗️ Como Funciona

### Fórmulas automáticas

O professor insere as notas na tabela e as fórmulas são recalculadas em tempo real. É possível configurar o **teto máximo de notas**, e todos os cálculos — médias individuais, média da turma, aprovados/reprovados — se ajustam automaticamente.

```
Notas lançadas → Cálculo automático → Visualização em gráfico
       ↓                 ↓                      ↓
  Teto definido    Média por aluno        Barras / Linhas
  pelo professor   Média da turma         Pizza / Área
                   Comparações            Personalizado
```

### Tipos de gráficos disponíveis

A partir dos dados da tabela, o professor pode gerar instantaneamente visualizações como gráficos de barras para comparar desempenho entre alunos, gráficos de linha para acompanhar evolução ao longo do tempo, gráficos de pizza para distribuição de notas por faixa, e gráficos de área para análise de tendência da turma.

---

## 🤝 Contribuindo

1. Faça um **fork** do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um **Pull Request**

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">

Feito com ☕ por **[BigOnwer](https://github.com/BigOnwer)**

</div>
