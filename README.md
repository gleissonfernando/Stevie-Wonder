# Steve Wonder

Sistema profissional de gerenciamento para Discord com Bot + Dashboard Next.js + API Express + PostgreSQL/Prisma.

## Como iniciar

1. Instale as dependencias do bot/API:

```bash
npm install
```

2. Instale as dependencias do dashboard:

```bash
npm install --prefix dashboard/frontend
```

3. Configure o arquivo `.env`:

```env
DISCORD_TOKEN=seu_token
CLIENT_ID=id_da_aplicacao
DISCORD_CLIENT_SECRET=client_secret_oauth
GUILD_ID=id_do_servidor_de_teste
DISCORD_LIVE_CHANNEL_ID=id_do_canal_de_lives
RULES_CHANNEL_ID=id_do_canal_de_regras
DATABASE_URL=postgresql://usuario_exemplo:senha_exemplo@db.example.invalid:5432/banco_exemplo?schema=public
JWT_SECRET=segredo_forte
INTERNAL_WEBHOOK_SECRET=segredo_interno
TWITCH_CLIENT_ID=client_id_twitch
TWITCH_CLIENT_SECRET=client_secret_twitch
TWITCH_REDIRECT_URL=https://twitch-callback.example.invalid
```

4. Gere o Prisma Client e rode as migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Registre os slash commands:

```bash
npm run deploy
```

6. Inicie a API:

```bash
npm run backend
```

7. Inicie o bot:

```bash
npm start
```

8. Inicie o site:

```bash
npm run frontend
```

## Estrutura

- `src/commands`: comandos slash separados por categoria.
- `src/events`: eventos do Discord.
- `src/components`: botoes, modais e menus.
- `src/services`: integracoes com Discord, banco e APIs.
- `src/utils`: helpers compartilhados.
- `src/config`: configuracoes e permissoes.
- `prisma/schema.prisma`: schema PostgreSQL com lives, logs e notificacoes.
- `database`: schemas e backups.
- `dashboard/backend`: API Express com OAuth2 Discord, lives, rate limit e SSE.
- `dashboard/frontend`: dashboard Next.js, TypeScript, Tailwind CSS e componentes estilo shadcn/ui.

## Painel de Lives

Fluxo implementado:

- Login obrigatorio via Discord OAuth2.
- Validacao de membro autorizado pelo `GUILD_ID`.
- Criacao de solicitacao de live pelo site.
- Persistencia em PostgreSQL via Prisma.
- Envio de card Components V2 para o canal `DISCORD_LIVE_CHANNEL_ID`.
- Botoes administrativos para aprovar, recusar e solicitar alteracao.
- Modais no Discord para motivo de recusa ou alteracao.
- DM para o usuario em aprovacoes, recusas e alteracoes.
- Notificacoes no site em tempo real via Server-Sent Events.
- Dashboard com totais, ultimas solicitacoes, historico completo e toasts.

## Twitch Helix

A integracao com a Twitch usa OAuth Client Credentials Flow:

- `TWITCH_CLIENT_ID`: ID publico da aplicacao Twitch.
- `TWITCH_CLIENT_SECRET`: segredo privado da aplicacao, somente via variavel de ambiente.
- `TWITCH_REDIRECT_URL`: URL de redirect cadastrada para desenvolvimento.
- `TWITCH_TOKEN_URL`: endpoint de token da Twitch.
- `TWITCH_HELIX_URL`: endpoint base da Helix API.

O Client Secret nao deve ser colocado no codigo, logs, mensagens do bot ou respostas publicas. Use o arquivo `.env` local e mantenha `.env.example` sem valores reais.

## Seguranca

- Nunca commite `.env`, URLs reais de producao, IDs reais de canais/cargos/servidores ou tokens.
- Use apenas placeholders em arquivos versionados, como `example.invalid`, `id_do_canal` e `client_id_twitch`.
- Rode `npm run security:check` antes de fazer push.
- Se algum valor real ja foi publicado, rotacione/recrie esse valor na plataforma correspondente.

## Pagina Lives

A pagina `/dashboard/lives` gerencia notificacoes sociais por servidor:

- YouTube e TikTok aparecem como cards visuais.
- Twitch permite cadastrar ate 5 canais por servidor.
- As configuracoes sao salvas no MongoDB por `guildId`.
- Apenas dono do servidor, administradores ou IDs em `AUTHORIZED_USER_IDS` podem acessar.
- A API valida canal duplicado, limite de 5, canal Discord e permissao basica de envio do bot.
- A rota `POST /api/lives/check` verifica streams ativas e envia alerta no Discord.
- A API tambem agenda a verificacao automaticamente usando `LIVE_CHECK_INTERVAL_SECONDS`.

Rotas:

- `GET /api/lives`
- `POST /api/lives/twitch`
- `PUT /api/lives/twitch/:id`
- `DELETE /api/lives/twitch/:id`
- `POST /api/lives/check`

Variaveis usadas:

```env
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
MONGODB_URI=
DISCORD_BOT_TOKEN=
NEXT_PUBLIC_SITE_URL=
LIVE_CHECK_INTERVAL_SECONDS=180
```

## Criando comandos

Crie um arquivo dentro de uma categoria em `src/commands`:

```js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("exemplo")
    .setDescription("Comando de exemplo."),
  async execute(interaction) {
    await interaction.reply("Funcionou!");
  }
};
```
