import { Router } from "express";
import type { Request } from "express";
import { discordAvatarUrl, exchangeCode, fetchDiscordUser, oauthUrl } from "../discord";
import { env } from "../env";
import { requireAuth, signSession } from "../auth";

export const authRoutes = Router();

function publicBaseUrl(request: Request) {
  const configuredSiteUrl = env.siteUrl.replace(/\/+$/, "");

  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(request.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const protocol = forwardedProto || request.protocol;
  const host = forwardedHost || request.get("host");

  if (host && !host.includes("localhost")) {
    return `https://${host}`.replace(/\/+$/, "");
  }

  if (configuredSiteUrl && !configuredSiteUrl.includes("localhost")) {
    return configuredSiteUrl;
  }

  if (!host) return configuredSiteUrl;

  return `${protocol}://${host}`.replace(/\/+$/, "");
}

function discordRedirectUri(request: Request) {
  const configuredRedirectUri = process.env.DISCORD_REDIRECT_URI || "";

  if (configuredRedirectUri && !configuredRedirectUri.includes("localhost")) {
    return configuredRedirectUri;
  }

  return `${publicBaseUrl(request)}/api/auth/discord/callback`;
}

function sessionCookieBaseOptions(request: Request) {
  const host = request.get("host") || "";
  const isLocalhost = host.includes("localhost");
  const secure =
    request.secure ||
    request.headers["x-forwarded-proto"] === "https" ||
    !isLocalhost;

  return {
    httpOnly: true,
    path: "/",
    sameSite: isLocalhost ? ("lax" as const) : ("none" as const),
    secure
  };
}

function sessionCookieOptions(request: Request) {
  return {
    ...sessionCookieBaseOptions(request),
    maxAge: 1000 * 60 * 60 * 24 * 7
  };
}

function sessionBridgeHtml(session: string, redirectUrl: string) {
  const serializedSession = JSON.stringify(session);
  const serializedRedirectUrl = JSON.stringify(redirectUrl);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sessao validada</title>
    <style>
      html, body { min-height: 100%; margin: 0; background: #000; color: #fff; font-family: Inter, system-ui, sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { width: min(100%, 440px); padding: 32px; border: 1px solid #262626; border-radius: 8px; background: #0d0d0d; text-align: center; }
      h1 { margin: 0; font-size: 30px; }
      p { color: #c7c7c7; line-height: 1.6; }
      a { display: inline-flex; min-height: 42px; align-items: center; padding: 0 15px; border-radius: 8px; background: #f5f5f5; color: #050505; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Acesso liberado</h1>
        <p>Sua conta Discord foi verificada. Abrindo o dashboard...</p>
        <a href="/dashboard">Abrir dashboard</a>
      </section>
    </main>
    <script>
      try {
        localStorage.setItem("live_alerts_session", ${serializedSession});
        document.cookie = "live_alerts_session_fallback=" + encodeURIComponent(${serializedSession}) + "; path=/; max-age=604800; SameSite=Lax";
      } catch (error) {
        document.cookie = "live_alerts_session_fallback=" + encodeURIComponent(${serializedSession}) + "; path=/; max-age=604800; SameSite=Lax";
      }
      window.location.replace(${serializedRedirectUrl});
    </script>
  </body>
</html>`;
}

authRoutes.get("/discord", (request, response) => {
  try {
    response.redirect(oauthUrl(discordRedirectUri(request)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord_auth_failed";
    const code = message === "discord_client_id_missing" ? message : "discord_auth_failed";
    response.redirect(`${publicBaseUrl(request)}/?error=${code}`);
  }
});

authRoutes.get("/me", requireAuth, (request, response) => {
  const { accessToken: _accessToken, ...user } = request.user!;
  response.json({ user });
});

authRoutes.get("/discord/callback", async (request, response, next) => {
  try {
    const code = String(request.query.code || "");
    if (!code) {
      response.redirect(`${publicBaseUrl(request)}/?error=missing_code`);
      return;
    }

    const token = await exchangeCode(code, discordRedirectUri(request));
    const discordUser = await fetchDiscordUser(token.access_token);

    const user = {
      id: discordUser.id,
      username: discordUser.global_name || discordUser.username,
      avatar: discordAvatarUrl(discordUser),
      accessToken: token.access_token
    };

    const session = signSession(user);
    response.cookie(env.cookieName, session, sessionCookieOptions(request));

    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
    );
    response.send(sessionBridgeHtml(session, `${publicBaseUrl(request)}/dashboard`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord_auth_failed";
    const code =
      message === "discord_client_id_missing" || message === "discord_client_secret_missing"
        ? message
        : "discord_auth_failed";
    response.redirect(`${publicBaseUrl(request)}/?error=${code}`);
  }
});

authRoutes.post("/logout", (request, response) => {
  response.clearCookie(env.cookieName, sessionCookieBaseOptions(request));
  response.json({ ok: true });
});

authRoutes.get("/logout", (request, response) => {
  response.clearCookie(env.cookieName, sessionCookieBaseOptions(request));
  response.redirect(publicBaseUrl(request));
});
