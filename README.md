# Ricardinn98 Dashboard

Bot Discord modular com dashboard web em Next.js, API Express, MongoDB, Discord OAuth2 e Socket.IO para atualizacao em tempo real.

## Redirect URI do Discord

No Discord Developer Portal, configure exatamente este redirect em:

`OAuth2 > Redirects`

```text
https://steviewonder.shardweb.app/api/auth/discord/callback
```

O `.env.example` ja vem com:

```env
DISCORD_REDIRECT_URI=https://steviewonder.shardweb.app/api/auth/discord/callback
NEXT_PUBLIC_SITE_URL=https://steviewonder.shardweb.app
```

## Como iniciar

1. Instale as dependencias:

```bash
npm install
```

2. Configure o `.env`:

```env
DISCORD_TOKEN=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://steviewonder.shardweb.app/api/auth/discord/callback
MONGODB_URI=
SESSION_SECRET=
JWT_SECRET=
NEXT_PUBLIC_SITE_URL=https://steviewonder.shardweb.app
HOST=0.0.0.0
PORT=80
API_PORT=80
SOCKET_PORT=80
DASHBOARD_ENABLED=true
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_REDIRECT_URI=https://steviewonder.shardweb.app/api/auth/twitch/callback
TWITCH_EVENTSUB_SECRET=
TWITCH_TOKEN_ENCRYPTION_KEY=
SITE_URL=https://steviewonder.shardweb.app
API_URL=https://steviewonder.shardweb.app
```

3. Registre os slash commands:

```bash
npm run deploy
```

4. Gere o build do painel:

```bash
npm run build
```

5. Inicie bot + dashboard:

```bash
npm start
```

O dashboard sobe no mesmo processo do bot. Na Shard Cloud use porta 80 e host `0.0.0.0`:

```env
HOST=0.0.0.0
PORT=80
API_PORT=80
SOCKET_PORT=80
```

Para rodar localmente, use:

```text
http://localhost:3000
```

```env
PORT=3000
API_PORT=3000
SOCKET_PORT=3000
```

Se aparecer `502 Bad Gateway` na Shard Cloud, confira estes pontos:

- O comando de start precisa ser `npm start`.
- A aplicacao precisa escutar em `0.0.0.0`.
- Em producao, configure `PORT=80`. `API_PORT` e `SOCKET_PORT` ficam como compatibilidade/local.
- `DISCORD_TOKEN`/`DISCORD_BOT_TOKEN` nao podem estar vazios. Mesmo assim, o dashboard agora sobe antes do login do bot para evitar que o proxy fique sem resposta.

## O que o painel entrega

- Login com Discord OAuth2 usando cookies httpOnly.
- Liberacao por dono do servidor, permissao Administrador ou cargo admin do painel.
- Selecao de servidores onde o bot esta presente.
- API protegida por servidor e `guildId`.
- MongoDB com collections de usuarios, guilds, configs, auditoria e sessoes.
- Socket.IO com eventos `dashboard:updateConfig`, `dashboard:testAlert`, `dashboard:sendNotice`, `bot:status`, `bot:ping`, `bot:error` e `bot:configUpdated`.
- Modulos de Twitch, boas-vindas, saida, logs, cargos, verificacao, avisos, comandos, aparencia, configuracoes e diagnostico.
- Sistema de Cargo Sub Twitch com OAuth Twitch, EventSub, vinculo Discord + Twitch e entrega/remocao automatica de cargo.
- O bot le configuracoes salvas e atualiza comportamento sem reiniciar.

## Sistema de Cargo Sub Twitch

O modulo fica em:

```text
/dashboard/:guildId/sub-twitch
```

A pagina de vinculo dos usuarios fica em:

```text
/vincular-conta
```

Fluxo:

1. O admin entra com Discord e abre `Sub Twitch` no servidor.
2. Clica em `Conectar Twitch` para conectar a conta do streamer.
3. Escolhe cargo de sub, canal de logs, mensagem e ativa o sistema.
4. O sistema cria assinaturas EventSub para `channel.subscribe`, `channel.subscription.message` e `channel.subscription.end`.
5. Cada usuario que quiser receber cargo acessa `/vincular-conta` e conecta Discord + Twitch.
6. Quando a Twitch envia a sub, o webhook valida a assinatura, busca o vinculo e entrega/remove o cargo no Discord.

Collections usadas:

- `twitchSubConfigs`
- `linkedAccounts`
- `twitchSubLogs`

Rotas principais:

```text
GET  /api/auth/twitch
GET  /api/auth/twitch/callback
POST /api/link/discord
POST /api/link/twitch
GET  /api/link/status
GET  /api/user/guilds
GET  /api/guild/:guildId/roles
GET  /api/guild/:guildId/channels
GET  /api/twitch/sub/config/:guildId
POST /api/twitch/sub/config
POST /api/twitch/sub/test
POST /api/twitch/eventsub/webhook
```

Configure na Twitch Developer Console:

```text
OAuth Redirect URL:
https://steviewonder.shardweb.app/api/auth/twitch/callback

EventSub Webhook Callback:
https://steviewonder.shardweb.app/api/twitch/eventsub/webhook
```

O segredo do EventSub deve ser o mesmo valor de `TWITCH_EVENTSUB_SECRET`.

## Scripts

```bash
npm start          # inicia bot + dashboard
npm run bot        # inicia o bot
npm run dev        # inicia com nodemon
npm run build      # build do Next.js
npm run deploy     # registra slash commands
npm run security:check
npm audit
```

## Estrutura principal

- `app`: paginas Next.js do dashboard.
- `components/dashboard`: componentes visuais do painel.
- `lib`: tipos, helpers de API e definicoes dos modulos.
- `src/web`: servidor Express, rotas API e Socket.IO.
- `src/services/dashboard`: OAuth, permissoes, configs e ponte com o bot.
- `src/models/dashboard.js`: models Mongoose das collections do painel.
- `src/events`: eventos Discord integrados ao dashboard.

## Observacoes de seguranca

- Nunca exponha `DISCORD_TOKEN`, `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_SECRET`, `JWT_SECRET` ou `SESSION_SECRET` no frontend.
- Use `JWT_SECRET` e `SESSION_SECRET` fortes em producao.
- O redirect do Discord precisa bater exatamente com o valor configurado no Developer Portal.
- As rotas `/api/guilds/:guildId/*` sempre validam a permissao do usuario naquele servidor.
