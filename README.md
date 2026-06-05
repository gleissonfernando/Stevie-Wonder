# Steve Wonder

Bot modular para Discord com comandos, eventos, componentes, auditoria e painel de regras.

## Como Iniciar

1. Instale as dependencias:

```bash
npm install
```

2. Configure o `.env`:

```env
DISCORD_TOKEN=seu_token
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor
RULES_CHANNEL_ID=id_do_canal_de_regras
AUDIT_LOG_CHANNEL_ID=id_do_canal_de_logs
MONGODB_URI=mongodb://usuario:senha@host:27017/banco
```

3. Registre os slash commands:

```bash
npm run deploy
```

4. Inicie o bot:

```bash
npm start
```

## Estrutura

- `src/commands`: comandos slash separados por categoria.
- `src/events`: eventos do Discord.
- `src/components`: botoes, modais e menus.
- `src/services`: integracoes com Discord e banco.
- `src/utils`: helpers compartilhados.
- `src/config`: configuracoes e permissoes.
- `database`: schemas e configuracoes auxiliares.

## Seguranca

- Nunca commite `.env`, tokens, IDs reais de canais/cargos/servidores ou secrets.
- Use apenas placeholders em arquivos versionados.
- Rode `npm run security:check` antes de fazer push.

## Criando Comandos

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
